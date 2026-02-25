/**
 * CHAT PROCESSOR — Shared logic for WhatsApp and Portal channels
 * ================================================================
 * Central processing pipeline:
 * 1. Classify intent (Vertex AI)
 * 2. Look up client/policy context
 * 3. Handle intent-specific logic
 * 4. Generate response (Vertex AI)
 * 5. Escalate if needed
 * 6. Log interaction
 */

import { classifyIntent, type ChatIntent } from '@/lib/intentClassifier';
import { generateResponse } from '@/lib/ai/vertex';
import {
  lookupClientByCedula,
  lookupClientByPhone,
  lookupPoliciesByClientId,
  lookupInsurer,
  formatInsurerContact,
  type ClientInfo,
  type PolicyInfo,
} from '@/lib/insuranceLookup';
import { sendEscalationAlert } from '@/lib/escalation';
import { logChatInteraction } from '@/lib/logging';

export interface ProcessMessageInput {
  message: string;
  channel: 'whatsapp' | 'portal';
  phone?: string | null;
  cedula?: string | null;
  sessionId?: string | null;
  ipAddress?: string | null;
  conversationHistory?: { role: string; content: string; timestamp?: string }[];
}

export interface ProcessMessageResult {
  reply: string;
  intent: ChatIntent;
  escalated: boolean;
  clientIdentified: boolean;
  requiresIdentityVerification: boolean;
  logId: string | null;
}

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Process a chat message through the full pipeline
 */
export async function processMessage(input: ProcessMessageInput): Promise<ProcessMessageResult> {
  // Sanitize input
  const message = sanitizeInput(input.message);
  if (!message) {
    return {
      reply: 'No recibí ningún mensaje. ¿En qué puedo ayudarle?',
      intent: 'OTRO',
      escalated: false,
      clientIdentified: false,
      requiresIdentityVerification: false,
      logId: null,
    };
  }

  // 1. Classify intent
  const classification = await classifyIntent(message);
  const intent = classification.intent;

  // 2. Look up client context
  let clientInfo: ClientInfo | null = null;
  let policies: PolicyInfo[] = [];

  // Try phone first, then cedula
  if (input.phone) {
    clientInfo = await lookupClientByPhone(input.phone);
  }
  if (!clientInfo && input.cedula) {
    clientInfo = await lookupClientByCedula(input.cedula);
  }

  if (clientInfo) {
    policies = await lookupPoliciesByClientId(clientInfo.id);
  }

  // 3. Handle intent-specific logic
  let reply: string;
  let escalated = false;

  switch (intent) {
    case 'COTIZAR':
      reply = '¡Hola! Puede cotizar su seguro directamente aquí:\n\n🔗 https://portal.lideresenseguros.com/cotizadores\n\nEl proceso es rápido y seguro. Si necesita ayuda adicional, no dude en escribirnos.';
      break;

    case 'PORTAL':
      reply = 'Puede acceder a su portal de clientes en:\n\n🔗 https://portal.lideresenseguros.com\n\nAllí podrá consultar sus pólizas, pagos y más. Si tiene alguna dificultad para acceder, estamos aquí para ayudarle.';
      break;

    case 'EMERGENCIA': {
      // Try to find the client's insurer for emergency number
      let emergencyInfo = '';
      if (policies.length > 0) {
        const insurerName = policies[0]?.insurer_name;
        if (insurerName) {
          const insurer = await lookupInsurer(insurerName);
          if (insurer?.emergency_phone) {
            emergencyInfo = `\n\n📞 Emergencias ${insurer.name}: ${insurer.emergency_phone}`;
          }
        }
      }
      if (!emergencyInfo) {
        emergencyInfo = '\n\nSi conoce su aseguradora, dígame cuál es para darle el número de emergencias directo.';
      }
      reply = `🚨 ¡ATENCIÓN INMEDIATA!\n\nLe recomendamos:\n1. Mantenga la calma y asegúrese de estar en un lugar seguro.\n2. Llame inmediatamente al número de emergencias de su aseguradora.\n3. No demore en reportar el siniestro — mientras más rápido mejor.${emergencyInfo}\n\n⚠️ Recuerde: No mueva el vehículo hasta que llegue el ajustador (si es accidente de auto).`;
      break;
    }

    case 'CONTACTO_ASEGURADORA': {
      const detectedName = classification.detectedInsurer;
      if (detectedName) {
        const insurer = await lookupInsurer(detectedName);
        if (insurer) {
          reply = `Aquí tiene los datos de contacto:\n\n${formatInsurerContact(insurer)}`;
        } else {
          reply = 'No encontré esa aseguradora en nuestro sistema. ¿Podría indicarme el nombre exacto de su aseguradora?';
        }
      } else if (policies.length > 0 && policies[0]?.insurer_name) {
        const insurer = await lookupInsurer(policies[0]!.insurer_name!);
        if (insurer) {
          reply = `Basado en su póliza, su aseguradora es:\n\n${formatInsurerContact(insurer)}`;
        } else {
          reply = '¿Podría indicarme el nombre de la aseguradora que necesita contactar?';
        }
      } else {
        reply = '¿Podría indicarme el nombre de la aseguradora que necesita contactar? Así le proporciono los datos correctos.';
      }
      break;
    }

    case 'POLIZA_ESPECIFICA': {
      if (!clientInfo) {
        if (classification.requiresIdentityVerification) {
          reply = 'Para consultar información de su póliza necesito verificar su identidad. ¿Podría proporcionarme su número de cédula?';
        } else {
          reply = 'Para consultar los detalles de su póliza, necesito verificar su identidad. Por favor indíqueme su número de cédula.';
        }
      } else if (policies.length === 0) {
        reply = `Hola ${clientInfo.name}. No encontré pólizas activas asociadas a su cuenta. Si cree que esto es un error, le sugiero contactar directamente a su aseguradora o escribirnos al portal para revisarlo.`;
      } else {
        // Generate AI response with policy context
        const aiResult = await generateResponse({
          message,
          clientContext: {
            name: clientInfo.name,
            cedula: clientInfo.cedula,
            region: clientInfo.region || undefined,
          },
          policyContext: { policies },
          intent,
        });
        reply = aiResult.reply;
      }
      break;
    }

    case 'COBERTURA_GENERAL': {
      const aiResult = await generateResponse({
        message,
        clientContext: clientInfo ? {
          name: clientInfo.name,
          region: clientInfo.region || undefined,
        } : null,
        policyContext: null,
        intent,
        conversationHistory: input.conversationHistory?.map(h => ({ role: h.role, content: h.content })),
      });
      reply = aiResult.reply;
      break;
    }

    case 'QUEJA': {
      const aiResult = await generateResponse({
        message,
        clientContext: clientInfo ? { name: clientInfo.name } : null,
        policyContext: null,
        intent,
        conversationHistory: input.conversationHistory?.map(h => ({ role: h.role, content: h.content })),
      });
      reply = aiResult.reply;
      break;
    }

    case 'EXTREMO': {
      escalated = true;
      reply = 'Entendemos su situación y la tomamos muy en serio. Un superior se pondrá en contacto con usted a la brevedad. Su caso ha sido escalado con máxima prioridad.\n\nSi necesita atención inmediata, puede comunicarse directamente con nosotros al portal: https://portal.lideresenseguros.com';

      // Send escalation email
      await sendEscalationAlert({
        clientName: clientInfo?.name || null,
        cedula: clientInfo?.cedula || input.cedula || null,
        phone: input.phone || null,
        channel: input.channel,
        intent,
        conversationHistory: [
          ...(input.conversationHistory || []),
          { role: 'user', content: message, timestamp: new Date().toISOString() },
        ],
        triggerMessage: message,
        sessionId: input.sessionId || undefined,
      });
      break;
    }

    default: {
      // OTRO or PORTAL — use AI
      const aiResult = await generateResponse({
        message,
        clientContext: clientInfo ? {
          name: clientInfo.name,
          region: clientInfo.region || undefined,
        } : null,
        policyContext: policies.length > 0 ? { policies } : null,
        intent,
        conversationHistory: input.conversationHistory?.map(h => ({ role: h.role, content: h.content })),
      });
      reply = aiResult.reply;
      break;
    }
  }

  // 6. Log interaction
  const logId = await logChatInteraction({
    channel: input.channel,
    clientId: clientInfo?.id || null,
    phone: input.phone || null,
    message,
    response: reply,
    intent,
    escalated,
    ipAddress: input.ipAddress || null,
    sessionId: input.sessionId || null,
    metadata: {
      clientIdentified: !!clientInfo,
      confidence: classification.confidence,
      detectedInsurer: classification.detectedInsurer,
    },
  });

  return {
    reply,
    intent,
    escalated,
    clientIdentified: !!clientInfo,
    requiresIdentityVerification: classification.requiresIdentityVerification,
    logId,
  };
}

/**
 * Sanitize user input
 */
function sanitizeInput(message: string): string {
  if (!message) return '';
  // Trim, limit length, remove null bytes
  let cleaned = message.trim().replace(/\0/g, '');
  if (cleaned.length > MAX_MESSAGE_LENGTH) {
    cleaned = cleaned.substring(0, MAX_MESSAGE_LENGTH);
  }
  return cleaned;
}
