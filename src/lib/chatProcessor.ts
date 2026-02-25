/**
 * CHAT PROCESSOR — Shared logic for WhatsApp and Portal channels
 * ================================================================
 * AI-first architecture:
 * 1. Classify intent (keyword fast-path only for SALUDO/EMERGENCIA/EXTREMO/CEDULA)
 * 2. Look up client/policy/insurer context
 * 3. MOST messages → Vertex AI for natural, contextual response
 * 4. Escalate EXTREMO cases
 * 5. Log interaction
 * 6. Maintain conversation history per phone
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

const INSURER_KEYWORDS: Record<string, string> = {
  'assa': 'ASSA', 'mapfre': 'MAPFRE', 'sura': 'SURA',
  'fedpa': 'FEDPA', 'general de seguros': 'General de Seguros',
  'ancón': 'Ancón', 'ancon': 'Ancón', 'mundial': 'Mundial de Seguros',
  'pan american': 'Pan American', 'internacional': 'Internacional de Seguros',
  'sagicor': 'Sagicor', 'banistmo': 'Banistmo Seguros',
};

function detectInsurerKeyword(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [keyword, name] of Object.entries(INSURER_KEYWORDS)) {
    if (lower.includes(keyword)) return name;
  }
  return null;
}

// ── In-memory conversation history per phone (last 10 messages, 30 min TTL) ──
interface ConvEntry { role: string; content: string; ts: number; }
const conversationStore = new Map<string, ConvEntry[]>();
const CONV_MAX_MESSAGES = 10;
const CONV_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getConversationHistory(key: string): { role: string; content: string }[] {
  const entries = conversationStore.get(key);
  if (!entries) return [];
  const now = Date.now();
  // Filter out stale entries
  const fresh = entries.filter(e => now - e.ts < CONV_TTL_MS);
  if (fresh.length !== entries.length) conversationStore.set(key, fresh);
  return fresh.map(e => ({ role: e.role, content: e.content }));
}

function appendConversation(key: string, role: string, content: string) {
  if (!conversationStore.has(key)) conversationStore.set(key, []);
  const entries = conversationStore.get(key)!;
  entries.push({ role, content, ts: Date.now() });
  // Keep only last N messages
  while (entries.length > CONV_MAX_MESSAGES) entries.shift();
}

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

  // 3. Build conversation history key
  const convKey = input.phone || input.sessionId || 'anonymous';
  const history = input.conversationHistory?.map(h => ({ role: h.role, content: h.content })) || getConversationHistory(convKey);

  // 4. Handle intent-specific logic
  let reply: string;
  let escalated = false;

  // Build enriched context for AI (insurer data, links, etc.)
  let extraContext = '';
  // Try AI-detected insurer first, then keyword fallback
  const insurerName = classification.detectedInsurer || detectInsurerKeyword(message);
  if (insurerName) {
    const insurer = await lookupInsurer(insurerName);
    if (insurer) {
      extraContext += `\nDatos de ${insurer.name}: ${formatInsurerContact(insurer)}`;
    }
  }

  switch (intent) {
    // ── SALUDO: Static welcome (instant, no AI needed) ──
    case 'SALUDO':
      reply = '¡Hola! 👋 Mi nombre es *Lissa*, soy tu asistente virtual de *Líderes en Seguros* 💚\n\n¿En qué puedo ayudarte hoy? Puedes preguntarme lo que necesites sobre seguros, cotizaciones, pólizas, coberturas o lo que sea — ¡escríbeme con confianza!';
      break;

    // ── EMERGENCIA: Safety-critical, static + insurer lookup ──
    case 'EMERGENCIA': {
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
      reply = `🚨 ¡Entendido! Esto es urgente.\n\nTe recomiendo:\n1. Mantén la calma y asegúrate de estar en un lugar seguro.\n2. Llama inmediatamente al número de emergencias de tu aseguradora.\n3. Reporta el siniestro lo antes posible.${emergencyInfo}\n\nEstoy aquí si necesitas algo más — Lissa 💚`;
      break;
    }

    // ── POLIZA_ESPECIFICA: Cédula verification flow ──
    case 'POLIZA_ESPECIFICA': {
      if (!clientInfo && !cedulaFromMessage) {
        reply = '¡Claro que sí! Para revisar tu póliza necesito verificar tu identidad 🔐\n\n¿Me compartes tu número de cédula? Así te busco tus datos de forma segura 😊';
      } else if (!clientInfo && cedulaFromMessage) {
        reply = `Mmm, no encontré una cuenta con la cédula ${cedulaFromMessage} en nuestro sistema 🤔\n\nPuede ser que esté registrada con otro número. Escríbenos a contacto@lideresenseguros.com o llámanos al 223-2373 y lo verificamos juntos 😊\n\n— Lissa 💚`;
      } else if (clientInfo && policies.length === 0) {
        reply = `¡Hola ${clientInfo.name}! 👋 Te encontré, pero no veo pólizas activas. Escríbenos a contacto@lideresenseguros.com o llámanos al 223-2373 y lo revisamos 😊\n\n— Lissa 💚`;
      } else if (clientInfo && policies.length > 0) {
        // Use AI with policy context for natural response
        try {
          const aiResult = await generateResponse({
            message,
            clientContext: { name: clientInfo.name, cedula: clientInfo.cedula, region: clientInfo.region || undefined },
            policyContext: { policies },
            intent,
            conversationHistory: history,
          });
          reply = aiResult.reply;
        } catch {
          // Fallback: warm policy summary
          let summary = `¡Hola ${clientInfo.name}! 👋 `;
          if (policies.length === 1) {
            const p = policies[0]!;
            summary += `Tienes una póliza de *${p.ramo || 'seguro'}* con *${p.insurer_name || 'tu aseguradora'}* (${p.policy_number || 'N/A'}).`;
          } else {
            summary += `Tienes ${policies.length} pólizas activas.`;
          }
          summary += '\n\n¿Qué necesitas saber? 😊\n\n— Lissa 💚';
          reply = summary;
        }
      } else {
        reply = LISSA_FALLBACK;
      }
      break;
    }

    // ── EXTREMO: Escalation (static + email alert) ──
    case 'EXTREMO': {
      escalated = true;
      reply = 'Entiendo tu situación y la tomo muy en serio. Un supervisor se pondrá en contacto contigo a la brevedad. Tu caso ha sido escalado con máxima prioridad.\n\nSi necesitas atención inmediata:\n📧 contacto@lideresenseguros.com\n📞 223-2373\n\n— Lissa, Líderes en Seguros 💚';

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

    // ── ALL OTHER INTENTS: Vertex AI generates the response ──
    default: {
      try {
        const aiResult = await generateResponse({
          message: extraContext ? `${message}\n\n[Datos relevantes: ${extraContext}]` : message,
          clientContext: clientInfo ? {
            name: clientInfo.name,
            region: clientInfo.region || undefined,
          } : null,
          policyContext: policies.length > 0 ? { policies } : null,
          intent,
          conversationHistory: history,
        });
        reply = aiResult.reply;
      } catch {
        reply = LISSA_FALLBACK;
      }
      break;
    }
  }

  // 5. Store conversation history
  appendConversation(convKey, 'user', message);
  appendConversation(convKey, 'model', reply);

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
