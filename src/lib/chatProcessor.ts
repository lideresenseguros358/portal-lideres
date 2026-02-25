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
 * Extract a cédula number from message text (e.g. "8-932-1155", "PE-12-345")
 */
function extractCedula(message: string): string | null {
  const trimmed = message.trim();
  const pattern = /^(PE|E|N|\d{1,2})[-\s]?\d{2,4}[-\s]?\d{2,6}$/i;
  if (pattern.test(trimmed)) return trimmed;
  return null;
}

const LISSA_FALLBACK = '¡Hola! Soy Lissa de Líderes en Seguros 💚 En este momento no puedo procesar tu consulta, pero no te preocupes — puedes contactarnos directamente y te atendemos con gusto:\n\n📧 contacto@lideresenseguros.com\n📞 223-2373\n\n¡Estamos para ayudarte!';

/**
 * Process a chat message through the full pipeline
 */
export async function processMessage(input: ProcessMessageInput): Promise<ProcessMessageResult> {
  // Sanitize input
  const message = sanitizeInput(input.message);
  if (!message) {
    return {
      reply: '¡Hola! Soy Lissa, tu asistente virtual de Líderes en Seguros 💚 No recibí ningún mensaje. ¿En qué puedo ayudarte?',
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

  // Try phone first, then cedula from input, then extract cedula from message
  if (input.phone) {
    clientInfo = await lookupClientByPhone(input.phone);
  }
  if (!clientInfo && input.cedula) {
    clientInfo = await lookupClientByCedula(input.cedula);
  }
  // If message looks like a cédula, try to look up by it
  const cedulaFromMessage = extractCedula(message);
  if (!clientInfo && cedulaFromMessage) {
    clientInfo = await lookupClientByCedula(cedulaFromMessage);
  }

  if (clientInfo) {
    policies = await lookupPoliciesByClientId(clientInfo.id);
  }

  // 3. Handle intent-specific logic
  let reply: string;
  let escalated = false;

  switch (intent) {
    case 'SALUDO':
      reply = '¡Hola! 👋 Mi nombre es *Lissa*, soy tu asistente virtual de *Líderes en Seguros* 💚\n\n¿En qué puedo ayudarte hoy? Puedo asistirte con:\n\n📊 Cotizar un seguro\n📋 Consultar tu póliza\n🏥 Emergencias y siniestros\n📞 Contacto de aseguradoras\n❓ Cualquier otra consulta\n\n¡Escríbeme con confianza!';
      break;

    case 'COTIZAR':
      reply = '¡Hola! Soy Lissa 💚 Puedes cotizar tu seguro directamente aquí:\n\n🔗 https://portal.lideresenseguros.com/cotizadores\n\nEl proceso es rápido y seguro. Si necesitas ayuda adicional, ¡escríbeme!';
      break;

    case 'PORTAL':
      reply = 'Puedes acceder a tu portal de clientes aquí:\n\n🔗 https://portal.lideresenseguros.com\n\nAllí podrás consultar tus pólizas, pagos y más. Si tienes alguna dificultad para acceder, ¡aquí estoy para ayudarte! — Lissa 💚';
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
        emergencyInfo = '\n\nSi me dices cuál es tu aseguradora, te doy el número de emergencias directo.';
      }
      reply = `🚨 ¡Entendido! Esto es urgente.\n\nTe recomiendo:\n1. Mantén la calma y asegúrate de estar en un lugar seguro.\n2. Llama inmediatamente al número de emergencias de tu aseguradora.\n3. No demores en reportar el siniestro — mientras más rápido, mejor.${emergencyInfo}\n\n⚠️ Recuerda: No muevas el vehículo hasta que llegue el ajustador (si es accidente de auto).\n\nEstoy aquí si necesitas algo más — Lissa 💚`;
      break;
    }

    case 'CONTACTO_ASEGURADORA': {
      const detectedName = classification.detectedInsurer;
      if (detectedName) {
        const insurer = await lookupInsurer(detectedName);
        if (insurer) {
          reply = `¡Claro! Aquí tienes los datos de contacto:\n\n${formatInsurerContact(insurer)}\n\n¿Necesitas algo más? — Lissa 💚`;
        } else {
          reply = 'No encontré esa aseguradora en mi sistema 🤔 ¿Podrías decirme el nombre exacto? Así te busco los datos correctos.';
        }
      } else if (policies.length > 0 && policies[0]?.insurer_name) {
        const insurer = await lookupInsurer(policies[0]!.insurer_name!);
        if (insurer) {
          reply = `Según tu póliza, tu aseguradora es:\n\n${formatInsurerContact(insurer)}\n\n¿Te puedo ayudar en algo más? — Lissa 💚`;
        } else {
          reply = '¿Podrías decirme el nombre de la aseguradora que necesitas contactar? Así te busco los datos correctos 😊';
        }
      } else {
        reply = '¿Podrías decirme el nombre de la aseguradora que necesitas contactar? Así te busco los datos correctos 😊';
      }
      break;
    }

    case 'POLIZA_ESPECIFICA': {
      if (!clientInfo && !cedulaFromMessage) {
        // No client found and no cédula provided — ask for it
        reply = '¡Claro que sí! Para poder revisar tu póliza necesito verificar tu identidad 🔐\n\n¿Me podrías compartir tu número de cédula? Así te busco tus datos de forma segura 😊';
      } else if (!clientInfo && cedulaFromMessage) {
        // Cédula provided but not found in system
        reply = `Mmm, no encontré una cuenta con la cédula ${cedulaFromMessage} en nuestro sistema 🤔\n\nPuede ser que esté registrada con otro número o que aún no tengas póliza con nosotros. Si crees que es un error, escríbenos a contacto@lideresenseguros.com o llámanos al 223-2373 y lo verificamos juntos 😊\n\n\u2014 Lissa 💚`;
      } else if (clientInfo && policies.length === 0) {
        reply = `¡Hola ${clientInfo.name}! 👋 Te encontré en nuestro sistema, pero no veo pólizas activas asociadas a tu cuenta.\n\nSi crees que es un error, escríbenos a contacto@lideresenseguros.com o llámanos al 223-2373 y lo revisamos juntos 😊\n\n\u2014 Lissa 💚`;
      } else if (clientInfo && policies.length > 0) {
        // Build a warm, human summary of their policies
        let policySummary = `¡Hola ${clientInfo.name}! 👋 Encontré tu información. `;
        if (policies.length === 1) {
          const p = policies[0]!;
          policySummary += `Tienes una póliza de *${p.ramo || 'seguro'}* con *${p.insurer_name || 'tu aseguradora'}*.\n\n`;
          policySummary += `📋 *Póliza:* ${p.policy_number || 'N/A'}\n`;
          policySummary += `📅 *Estado:* ${p.status || 'N/A'}\n`;
          if (p.renewal_date) policySummary += `🔄 *Vencimiento:* ${p.renewal_date}\n`;
        } else {
          policySummary += `Tienes ${policies.length} pólizas activas:\n\n`;
          for (const p of policies) {
            policySummary += `📋 *${p.ramo || 'Seguro'}* con ${p.insurer_name || 'N/A'} — Póliza: ${p.policy_number || 'N/A'} (${p.status || 'N/A'})\n`;
          }
        }
        policySummary += `\n¿Qué necesitas saber sobre tu póliza? Puedo ayudarte con coberturas, vencimientos, pagos o cualquier duda que tengas 😊\n\n\u2014 Lissa 💚`;

        // Try AI for a more contextual response, fall back to summary
        try {
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
        } catch {
          reply = policySummary;
        }
      } else {
        reply = LISSA_FALLBACK;
      }
      break;
    }

    case 'COBERTURA_GENERAL': {
      try {
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
      } catch {
        reply = 'Las coberturas varían según el tipo de seguro y la aseguradora 📋 Para darte información precisa, te invito a cotizar directamente en nuestro portal:\n\n🔗 https://portal.lideresenseguros.com/cotizadores\n\nO si prefieres, escríbenos a contacto@lideresenseguros.com y te asesoramos personalmente 😊\n\n\u2014 Lissa 💚';
      }
      break;
    }

    case 'QUEJA': {
      try {
        const aiResult = await generateResponse({
          message,
          clientContext: clientInfo ? { name: clientInfo.name } : null,
          policyContext: null,
          intent,
          conversationHistory: input.conversationHistory?.map(h => ({ role: h.role, content: h.content })),
        });
        reply = aiResult.reply;
      } catch {
        reply = 'Lamento mucho lo que estás pasando 😔 Tu caso es muy importante para nosotros y quiero asegurarme de que recibas la atención que mereces.\n\nPor favor escríbenos directamente para darle seguimiento:\n📧 contacto@lideresenseguros.com\n📞 223-2373\n\nNos comprometemos a revisar tu caso lo antes posible.\n\n\u2014 Lissa, Líderes en Seguros 💚';
      }
      break;
    }

    case 'EXTREMO': {
      escalated = true;
      reply = 'Entiendo tu situación y la tomo muy en serio. Un supervisor se pondrá en contacto contigo a la brevedad. Tu caso ha sido escalado con máxima prioridad.\n\nSi necesitas atención inmediata:\n📧 contacto@lideresenseguros.com\n📞 223-2373\n\n\u2014 Lissa, Líderes en Seguros 💚';

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
      // OTRO — use AI with warm fallback
      try {
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
      } catch {
        reply = '¡Hola! Soy Lissa 💚 Gracias por escribirnos. Para poder ayudarte mejor, te invito a:\n\n📊 Cotizar tu seguro: https://portal.lideresenseguros.com/cotizadores\n💻 Acceder al portal: https://portal.lideresenseguros.com\n📧 Escribirnos: contacto@lideresenseguros.com\n📞 Llamarnos: 223-2373\n\n¡Estoy aquí para lo que necesites!';
      }
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
