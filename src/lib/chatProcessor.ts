/**
 * CHAT PROCESSOR — Shared logic for WhatsApp and Portal channels
 * ================================================================
 * FULLY AI-first architecture:
 * 1. Classify intent (keyword fast-path ONLY for EXTREMO + CEDULA)
 * 2. Enrich context: client, policies, insurer data, plan APIs
 * 3. ALL messages → Vertex AI (even simple ones, so AI can combine topics)
 * 4. Only EXTREMO triggers static escalation
 * 5. Maintain conversation history per phone
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

/**
 * Fetch insurance plan data from FEDPA and IS APIs for AI context.
 * Cached in memory for 1 hour to avoid repeated API calls.
 */
let planDataCache: { data: string; ts: number } | null = null;
const PLAN_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchInsurancePlanData(): Promise<string | null> {
  // Return cached if fresh
  if (planDataCache && Date.now() - planDataCache.ts < PLAN_CACHE_TTL) {
    return planDataCache.data;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || 'http://localhost:3000';

  const parts: string[] = [];

  // Fetch FEDPA plans (third-party / daños a terceros)
  try {
    const fedpaRes = await fetch(`${baseUrl}/api/fedpa/third-party`, { signal: AbortSignal.timeout(8000) });
    if (fedpaRes.ok) {
      const fedpa = await fedpaRes.json();
      if (fedpa.success && fedpa.plans?.length) {
        let fedpaText = 'PLANES DE FEDPA (Daños a Terceros):';
        for (const plan of fedpa.plans) {
          fedpaText += `\n- ${plan.name}: Prima anual $${plan.annualPremium}`;
          if (plan.coverageList?.length) {
            fedpaText += `. Coberturas: ${plan.coverageList.map((c: any) => `${c.name} (${c.limit})`).join(', ')}`;
          }
          if (plan.endosoBenefits?.length) {
            fedpaText += `. Beneficios del endoso: ${plan.endosoBenefits.slice(0, 5).join(', ')}`;
          }
          if (plan.installments?.available) {
            fedpaText += `. Se puede pagar en ${plan.installments.payments} cuotas de $${plan.installments.amount}`;
          }
        }
        parts.push(fedpaText);
      }
    }
  } catch (e) {
    console.warn('[CHAT] FEDPA plan fetch failed:', e);
  }

  // Fetch IS (Internacional de Seguros) plans
  try {
    const isRes = await fetch(`${baseUrl}/api/is/third-party`, { signal: AbortSignal.timeout(8000) });
    if (isRes.ok) {
      const is = await isRes.json();
      if (is.success && is.plans?.length) {
        let isText = 'PLANES DE INTERNACIONAL DE SEGUROS (Daños a Terceros):';
        for (const plan of is.plans) {
          isText += `\n- ${plan.name}: Prima anual $${plan.annualPremium}`;
          if (plan.coverageList?.length) {
            isText += `. Coberturas: ${plan.coverageList.map((c: any) => `${c.name} (${c.limit})`).join(', ')}`;
          }
        }
        parts.push(isText);
      }
    }
  } catch (e) {
    console.warn('[CHAT] IS plan fetch failed:', e);
  }

  if (parts.length === 0) return null;

  const result = parts.join('\n\n');
  planDataCache = { data: result, ts: Date.now() };
  return result;
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

  // ── EXTREMO: Only static path — immediate escalation ──
  if (intent === 'EXTREMO') {
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

  // ── POLIZA_ESPECIFICA with cédula sub-flow (static only when no client found) ──
  } else if (intent === 'POLIZA_ESPECIFICA' && !clientInfo && !cedulaFromMessage) {
    reply = '¡Claro que sí! Para revisar tu póliza necesito verificar tu identidad 🔐\n\n¿Me compartes tu número de cédula? Así te busco tus datos de forma segura 😊';
  } else if (intent === 'POLIZA_ESPECIFICA' && !clientInfo && cedulaFromMessage) {
    reply = `Mmm, no encontré una cuenta con la cédula ${cedulaFromMessage} en nuestro sistema 🤔\n\nPuede ser que esté registrada con otro número. Escríbenos a contacto@lideresenseguros.com o llámanos al 223-2373 y lo verificamos juntos 😊\n\n— Lissa 💚`;

  // ── EVERYTHING ELSE: Vertex AI ──
  } else {
    // Fetch insurance plan data if the message mentions plans/benefits/coverage
    const lower = message.toLowerCase();
    const wantsPlanInfo = lower.includes('plan') || lower.includes('beneficio') || lower.includes('cobertura completa')
      || lower.includes('daños a terceros') || lower.includes('grua') || lower.includes('grúa')
      || lower.includes('asistencia') || lower.includes('endoso');

    if (wantsPlanInfo) {
      try {
        const planData = await fetchInsurancePlanData();
        if (planData) extraContext += `\n\n${planData}`;
      } catch (e) {
        console.warn('[CHAT] Error fetching plan data:', e);
      }
    }

    try {
      const aiResult = await generateResponse({
        message: extraContext ? `${message}\n\n[Datos relevantes para responder: ${extraContext}]` : message,
        clientContext: clientInfo ? {
          name: clientInfo.name,
          cedula: clientInfo.cedula,
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
