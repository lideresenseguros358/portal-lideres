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
import { detectRamo, RAMOS, OFFICE_HOURS } from '@/lib/ai/lissaKnowledge';
import { sendEscalationAlert } from '@/lib/escalation';
import { logChatInteraction } from '@/lib/logging';
import { createClient } from '@supabase/supabase-js';

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
 * Fetch insurance plan data for AI context.
 * Uses AUTO_THIRD_PARTY_INSURERS constants as base (correct prices),
 * enhanced with live API data from FEDPA and Internacional de Seguros.
 * Cached in memory for 2 hours to avoid repeated API calls.
 */
let planDataCache: { data: string; ts: number } | null = null;
const PLAN_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

const FEDPA_API = 'https://wscanales.segfedpa.com/EmisorFedpa.Api/api';

async function fetchInsurancePlanData(): Promise<string | null> {
  // Return cached if fresh
  if (planDataCache && Date.now() - planDataCache.ts < PLAN_CACHE_TTL) {
    console.log('[CHAT] Using cached plan data');
    return planDataCache.data;
  }

  // Import constants — these ARE the source of truth used by the cotizador
  // The portal keeps these updated via insurer APIs, so this data is always accurate
  const { AUTO_THIRD_PARTY_INSURERS, COVERAGE_LABELS } = await import('@/lib/constants/auto-quotes');

  const parts: string[] = [];

  // ── Helper: format a single coverage field for AI display ──
  const covLine = (label: string, value: string): string => {
    if (!value || value === 'no') return `${label}: NO incluido`;
    if (value === 'sí') return `${label}: Incluido`;
    if (value === 'Conexión') return `${label}: Conexión (la aseguradora hace la llamada al servicio, pero el costo lo cubre el asegurado)`;
    return `${label}: $${value}`;
  };

  const formatPlanCoverages = (coverages: Record<string, string>): string => {
    const labels = COVERAGE_LABELS as Record<string, string>;
    return Object.entries(coverages)
      .filter(([key]) => key !== 'fedpaAsist')
      .map(([key, val]) => covLine(labels[key] || key, val))
      .join('\n    ');
  };

  // ── FEDPA SEGUROS ──
  const fedpa = AUTO_THIRD_PARTY_INSURERS.find(i => i.id === 'fedpa');
  if (fedpa) {
    const bp = fedpa.basicPlan;
    const pp = fedpa.premiumPlan;

    const fedpaText = [
      `════ FEDPA SEGUROS — DAÑOS A TERCEROS ════`,
      `Fuente: Portal Líderes en Seguros (datos actualizados por API FEDPA)`,
      ``,
      `📋 PLAN BÁSICO — Prima anual: $${bp.annualPremium}`,
      `   Pago en cuotas: ${bp.installments.available ? `Sí — ${bp.installments.payments} cuotas de $${bp.installments.amount} c/u (total: $${bp.installments.totalWithInstallments})` : 'No disponible'}`,
      `   Coberturas:`,
      `    ${formatPlanCoverages(bp.coverages)}`,
      `   Beneficios del Endoso de Asistencia (incluido en el plan):`,
      ...(bp.endosoBenefits?.map(b => `    - ${b}`) ?? []),
      ``,
      `📋 PLAN VIP — Prima anual: $${pp.annualPremium}`,
      `   Pago en cuotas: ${pp.installments.available ? `Sí — ${pp.installments.payments} cuotas de $${pp.installments.amount} c/u (total: $${pp.installments.totalWithInstallments})` : 'No disponible'}`,
      `   Coberturas:`,
      `    ${formatPlanCoverages(pp.coverages)}`,
      `   Beneficios del Endoso de Asistencia (incluido en el plan):`,
      ...(pp.endosoBenefits?.map(b => `    - ${b}`) ?? []),
      ``,
      `📊 DIFERENCIAS CLAVE BÁSICO vs VIP:`,
      `   Daños a la propiedad: Básico $5,000 vs VIP $10,000`,
      `   Gastos médicos: Básico NO incluido vs VIP $500/$2,500`,
      `   Conductor designado: Básico NO vs VIP Sí (según disponibilidad)`,
      `   Vehículo de reemplazo: Básico NO vs VIP Sí (según disponibilidad)`,
      `   Precio: Básico $${bp.annualPremium}/año vs VIP $${pp.annualPremium}/año (diferencia: $${pp.annualPremium - bp.annualPremium})`,
    ].join('\n');

    parts.push(fedpaText);
    console.log(`[CHAT] FEDPA plans loaded from constants (basic=$${bp.annualPremium}, vip=$${pp.annualPremium})`);
  }

  // ── INTERNACIONAL DE SEGUROS ──
  const internacional = AUTO_THIRD_PARTY_INSURERS.find(i => i.id === 'internacional');
  if (internacional) {
    const bp = internacional.basicPlan;
    const pp = internacional.premiumPlan;

    const isText = [
      `════ INTERNACIONAL DE SEGUROS — DAÑOS A TERCEROS ════`,
      `Fuente: Portal Líderes en Seguros (datos actualizados por API Internacional)`,
      ``,
      `📋 PLAN BÁSICO — Prima anual: $${bp.annualPremium}`,
      `   Pago en cuotas: Solo al contado`,
      `   Coberturas:`,
      `    ${formatPlanCoverages(bp.coverages)}`,
      `   NOTA IMPORTANTE sobre "Conexión" en Plan Básico: Los campos de Grúa y Asistencia vial`,
      `   aparecen como "Conexión". Esto significa que NO están dentro de las coberturas pagadas`,
      `   por la póliza. La aseguradora acepta la llamada al número de asistencia (800-4600) y`,
      `   consigue el auxilio, pero el costo del servicio (grúa, etc.) lo debe cubrir el propio`,
      `   asegurado. Es un servicio de gestión/coordinación, no una cobertura incluida.`,
      `   Beneficios del Endoso de Asistencia:`,
      ...(bp.endosoBenefits?.map(b => `    - ${b}`) ?? []),
      ``,
      `📋 PLAN PREMIUM (Intermedio) — Prima anual: $${pp.annualPremium}`,
      `   Pago en cuotas: Solo al contado`,
      `   Coberturas:`,
      `    ${formatPlanCoverages(pp.coverages)}`,
      `   Beneficios del Endoso de Asistencia (todos incluidos):`,
      ...(pp.endosoBenefits?.map(b => `    - ${b}`) ?? []),
      ``,
      `📊 DIFERENCIAS CLAVE BÁSICO vs PREMIUM:`,
      `   Lesiones corporales: Básico $5,000/$10,000 vs Premium $10,000/$20,000`,
      `   Daños a la propiedad: Básico $5,000 vs Premium $10,000`,
      `   Gastos médicos: Básico $500/$2,500 vs Premium $2,000/$10,000`,
      `   Grúa: Básico solo Conexión (asegurado paga) vs Premium Incluida (hasta $150, máx 3 eventos/año)`,
      `   Asistencia legal: Básico NO vs Premium Incluida`,
      `   Conductor designado: Básico NO vs Premium Sí (según disponibilidad)`,
      `   Precio: Básico $${bp.annualPremium}/año vs Premium $${pp.annualPremium}/año (diferencia: $${pp.annualPremium - bp.annualPremium})`,
    ].join('\n');

    parts.push(isText);
    console.log(`[CHAT] Internacional plans loaded from constants (basic=$${bp.annualPremium}, premium=$${pp.annualPremium})`);
  }

  // ── COMPARATIVO ENTRE ASEGURADORAS ──
  const fedpaB = AUTO_THIRD_PARTY_INSURERS.find(i => i.id === 'fedpa');
  const intlB = AUTO_THIRD_PARTY_INSURERS.find(i => i.id === 'internacional');
  if (fedpaB && intlB) {
    const compare = [
      `════ COMPARATIVO GENERAL — DAÑOS A TERCEROS ════`,
      ``,
      `PLANES BÁSICOS:`,
      `   FEDPA Básico: $${fedpaB.basicPlan.annualPremium}/año | Incluye: muerte accidental conductor ($5,000), gastos funerarios ($1,500), grúa y asistencia vial INCLUIDAS | NO incluye: gastos médicos`,
      `   Internacional Básico: $${intlB.basicPlan.annualPremium}/año | Incluye: gastos médicos ($500/$2,500) | NO incluye: muerte accidental | Grúa/asistencia vial = solo Conexión (asegurado paga)`,
      ``,
      `PLANES VIP/PREMIUM:`,
      `   FEDPA VIP: $${fedpaB.premiumPlan.annualPremium}/año | Gastos médicos $500/$2,500, daños propiedad $10,000, conductor designado y vehículo reemplazo`,
      `   Internacional Premium: $${intlB.premiumPlan.annualPremium}/año | Gastos médicos $2,000/$10,000, daños propiedad $10,000, grúa hasta $150 (3 eventos/año), asistencia legal incluida`,
      ``,
      `DISPONIBILIDAD DE CUOTAS:`,
      `   FEDPA: Acepta 2 cuotas (Básico: $${fedpaB.basicPlan.installments.amount}/cuota, VIP: $${fedpaB.premiumPlan.installments.amount}/cuota)`,
      `   Internacional: Solo al contado`,
      ``,
      `RECOMENDACIÓN PARA EL USUARIO: Invitarlo a ver el comparativo completo y emitir en línea:`,
      `   Daños a Terceros: https://portal.lideresenseguros.com/cotizadores/third-party`,
    ].join('\n');
    parts.push(compare);
  }

  if (parts.length === 0) return null;

  const result = parts.join('\n\n');
  planDataCache = { data: result, ts: Date.now() };
  console.log(`[CHAT] Plan data cached (${result.length} chars)`);
  return result;
}

// ── Conversation history from Supabase (persists across Vercel serverless invocations) ──
const CONV_LOOKBACK_MS = 60 * 60 * 1000; // 1 hour
const CONV_MAX_PAIRS = 8; // last 8 message/response pairs = 16 turns

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Load conversation history from chat_interactions table.
 * Each row has message (user) + response (model) = 2 conversation turns.
 */
async function getConversationHistory(phone: string): Promise<{ role: string; content: string }[]> {
  if (!phone) return [];
  try {
    const sb = getSupabase();
    const since = new Date(Date.now() - CONV_LOOKBACK_MS).toISOString();
    const { data, error } = await sb
      .from('chat_interactions')
      .select('message, response, created_at')
      .eq('phone', phone)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(CONV_MAX_PAIRS);

    if (error) {
      console.warn('[CHAT] Error loading history from DB:', error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    // Convert rows into alternating user/model turns
    const history: { role: string; content: string }[] = [];
    for (const row of data) {
      if (row.message) history.push({ role: 'user', content: row.message });
      if (row.response) history.push({ role: 'model', content: row.response });
    }
    console.log(`[CHAT] Loaded ${data.length} history rows (${history.length} turns) for ${phone}`);
    return history;
  } catch (err: any) {
    console.warn('[CHAT] Exception loading history:', err.message);
    return [];
  }
}

/**
 * Fetch upcoming agenda events (next 7 days) to give Lissa context about
 * office hours, closures, and virtual days.
 */
async function fetchAgendaContext(): Promise<string | null> {
  try {
    const sb = getSupabase();
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: events, error } = await sb
      .from('events')
      .select('title, details, start_at, end_at, is_all_day, event_type, modality, zoom_url')
      .is('canceled_at', null)
      .gte('start_at', now.toISOString())
      .lte('start_at', inSevenDays.toISOString())
      .order('start_at', { ascending: true })
      .limit(10);

    if (error || !events || events.length === 0) return null;

    const panamaTZ = 'America/Panama';
    const lines: string[] = ['AGENDA DE OFICINA (próximos 7 días):'];

    for (const ev of events) {
      const startDate = new Date(ev.start_at).toLocaleDateString('es-PA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: panamaTZ });
      const startTime = ev.is_all_day ? 'Todo el día' : new Date(ev.start_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', timeZone: panamaTZ });
      const endTime = ev.is_all_day ? '' : ` – ${new Date(ev.end_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', timeZone: panamaTZ })}`;

      let typeLabel = '';
      if (ev.event_type === 'oficina_cerrada') typeLabel = ' 🔴 OFICINA CERRADA';
      else if (ev.event_type === 'oficina_virtual') typeLabel = ' 💻 DÍA VIRTUAL';
      else if (ev.modality === 'virtual') typeLabel = ' 💻 Virtual';
      else if (ev.modality === 'hibrida') typeLabel = ' 🔀 Híbrido';

      let line = `- ${startDate}, ${startTime}${endTime}${typeLabel}: ${ev.title}`;
      if (ev.details) line += ` (${ev.details.slice(0, 80)})`;
      if (ev.zoom_url && (ev.modality === 'virtual' || ev.modality === 'hibrida')) {
        line += ` → Zoom: ${ev.zoom_url}`;
      }
      lines.push(line);
    }

    // Also check if TODAY is a closed or virtual day
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const todaySpecial = events.find(ev => {
      const evStart = new Date(ev.start_at);
      return evStart >= todayStart && evStart < todayEnd &&
        (ev.event_type === 'oficina_cerrada' || ev.event_type === 'oficina_virtual');
    });

    if (todaySpecial) {
      const typeMsg = todaySpecial.event_type === 'oficina_cerrada'
        ? '⚠️ HOY LA OFICINA ESTÁ CERRADA'
        : '⚠️ HOY ES DÍA DE OFICINA VIRTUAL';
      lines.unshift(`${typeMsg}: ${todaySpecial.title}`);
    }

    return lines.join('\n');
  } catch (err: any) {
    console.warn('[CHAT] Error fetching agenda context:', err.message);
    return null;
  }
}

/**
 * Build ramo-routing context string for AI injection.
 * Detects if the message is about a specific ramo and adds specialist info.
 */
function buildRamoContext(message: string, conversationHistory: { role: string; content: string }[]): string | null {
  // Check current message + recent history for ramo hints
  const allText = [message, ...conversationHistory.slice(-4).map(h => h.content)].join(' ');
  const ramo = detectRamo(allText);
  if (!ramo) return null;

  const specialist = RAMOS[ramo];
  const lines = [
    `RAMO DETECTADO: ${specialist.label}`,
    `Especialista: ${specialist.specialistName} — ${specialist.specialist}`,
    `Horario de atención: ${OFFICE_HOURS.normal}`,
    `INSTRUCCIÓN: Si el usuario quiere cotizar, hablar con alguien o recibir asesoría sobre ${specialist.label}, indica el email de ${specialist.specialistName} (${specialist.specialist}) y el horario de atención.`,
  ];
  return lines.join('\n');
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

  // 3. Load conversation history from Supabase (persists across serverless invocations)
  const phone = input.phone || '';
  let history: { role: string; content: string }[] = [];
  if (input.conversationHistory?.length) {
    history = input.conversationHistory.map(h => ({ role: h.role, content: h.content }));
    console.log(`[CHAT] Using provided conversationHistory (${history.length} turns)`);
  } else if (phone) {
    history = await getConversationHistory(phone);
    console.log(`[CHAT] Loaded DB history for ${phone}: ${history.length} turns`);
  } else {
    console.log('[CHAT] No phone/history — starting fresh conversation');
  }

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
    // Fetch insurance plan data if the message OR recent history mentions plans/benefits/coverage
    const lower = message.toLowerCase();
    const historyText = history.map(h => h.content).join(' ').toLowerCase();
    const wantsPlanInfo = lower.includes('plan') || lower.includes('beneficio') || lower.includes('cobertura completa')
      || lower.includes('daños a terceros') || lower.includes('danos a terceros') || lower.includes('grua') || lower.includes('grúa')
      || lower.includes('asistencia') || lower.includes('endoso') || lower.includes('fedpa')
      || lower.includes('internacional') || lower.includes('seguro auto') || lower.includes('seguro de auto')
      || lower.includes('precio') || lower.includes('cotiz') || lower.includes('prima')
      || lower.includes('cuantas') || lower.includes('cuántas') || lower.includes('incluye') || lower.includes('incluido')
      || lower.includes('economico') || lower.includes('económico') || lower.includes('barato') || lower.includes('caro')
      || lower.includes('comparar') || lower.includes('comparativo') || lower.includes('diferencia') || lower.includes('cuota')
      || lower.includes('deducible') || lower.includes('limite') || lower.includes('límite') || lower.includes('maximo') || lower.includes('máximo')
      || lower.includes('que cubre') || lower.includes('qué cubre') || lower.includes('que tiene') || lower.includes('que incluye')
      || lower.includes('lesiones') || lower.includes('propiedad') || lower.includes('gastos medicos') || lower.includes('gastos médicos')
      || lower.includes('muerte accidental') || lower.includes('funeral') || lower.includes('ambulancia')
      || lower.includes('legal') || lower.includes('conductor designado') || lower.includes('vehiculo de remplazo') || lower.includes('vehículo de reemplazo')
      || lower.includes('basico') || lower.includes('básico') || lower.includes('vip') || lower.includes('premium') || lower.includes('intermedio')
      // Also trigger if recent conversation was about plans (follow-up questions)
      || (historyText.includes('fedpa') && (lower.includes('terceros') || lower.includes('basico') || lower.includes('básico') || lower.includes('premium') || lower.includes('cuota') || lower.includes('grua') || lower.includes('grúa')))
      || (historyText.includes('internacional') && (lower.includes('terceros') || lower.includes('basico') || lower.includes('básico') || lower.includes('premium') || lower.includes('diferencia') || lower.includes('conexión') || lower.includes('conexion')))
      || (historyText.includes('plan') && (lower.includes('terceros') || lower.includes('cuantas') || lower.includes('cuántas') || lower.includes('diferencia') || lower.includes('cual') || lower.includes('cuál') || lower.includes('escoger') || lower.includes('elegir') || lower.includes('recomiendas') || lower.includes('recomienda')))

    if (wantsPlanInfo) {
      try {
        console.log('[CHAT] Plan info requested, fetching...');
        const planData = await fetchInsurancePlanData();
        if (planData) {
          extraContext += `\n\n${planData}`;
          console.log(`[CHAT] Plan data added to context (${planData.length} chars)`);
        } else {
          console.warn('[CHAT] No plan data returned');
        }
      } catch (e) {
        console.warn('[CHAT] Error fetching plan data:', e);
      }
    }

    // ── Agenda context: always fetch so Lissa knows about closures/virtual days ──
    const lower2 = message.toLowerCase();
    const wantsAgendaOrHours = lower2.includes('horario') || lower2.includes('abierto') || lower2.includes('cerrado')
      || lower2.includes('oficina') || lower2.includes('disponible') || lower2.includes('atiend')
      || lower2.includes('hoy') || lower2.includes('mañana') || lower2.includes('semana')
      || lower2.includes('feriado') || lower2.includes('virtual') || lower2.includes('reunión')
      || lower2.includes('reunion') || lower2.includes('evento') || lower2.includes('agenda');

    if (wantsAgendaOrHours) {
      try {
        const agendaCtx = await fetchAgendaContext();
        if (agendaCtx) {
          extraContext += `\n\n${agendaCtx}`;
          console.log('[CHAT] Agenda context added');
        }
      } catch (e) {
        console.warn('[CHAT] Error fetching agenda context:', e);
      }
    }

    // ── Ramo routing context ──
    const ramoCtx = buildRamoContext(message, history);
    if (ramoCtx) {
      extraContext += `\n\n${ramoCtx}`;
      console.log('[CHAT] Ramo routing context added');
    }

    // Build the message with context — include history summary in message body as fallback
    let aiMessage = message;
    if (history.length > 0) {
      // Inject recent conversation summary directly into the message
      // This ensures the AI sees it even if contents[] history has issues
      const recentHistory = history.slice(-6); // last 3 exchanges
      const historyBlock = recentHistory.map(h => `${h.role === 'user' ? 'Usuario' : 'Lissa'}: ${h.content}`).join('\n');
      aiMessage = `[HISTORIAL RECIENTE de esta conversación — NO vuelvas a saludar, continúa naturalmente:]\n${historyBlock}\n\n[MENSAJE ACTUAL del usuario:]\n${message}`;
    }
    if (extraContext) {
      aiMessage += `\n\n[Datos relevantes para responder: ${extraContext}]`;
    }

    console.log('[CHAT] Sending to AI:', { intent, hasExtraContext: extraContext.length > 0, extraContextLen: extraContext.length, historyLen: history.length, messageLen: aiMessage.length });
    try {
      const aiResult = await generateResponse({
        message: aiMessage,
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

  // 5. Log interaction (this also serves as persistent conversation history)
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
