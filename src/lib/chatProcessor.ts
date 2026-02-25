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

  // Import constants — these are the source of truth used by the cotizador
  const { AUTO_THIRD_PARTY_INSURERS, COVERAGE_LABELS } = await import('@/lib/constants/auto-quotes');

  const parts: string[] = [];

  // ── Helper: format coverage object to readable text ──
  const formatCoverages = (coverages: Record<string, string>) => {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(coverages)) {
      if (key === 'fedpaAsist') continue; // skip internal field
      const label = (COVERAGE_LABELS as Record<string, string>)[key] || key;
      if (value && value !== 'no') {
        lines.push(`${label}: ${value === 'sí' ? '✓ Incluido' : '$' + value}`);
      }
    }
    return lines;
  };

  // ── FEDPA SEGUROS ──
  const fedpaInsurer = AUTO_THIRD_PARTY_INSURERS.find(i => i.id === 'fedpa');
  if (fedpaInsurer) {
    const bp = fedpaInsurer.basicPlan;
    const pp = fedpaInsurer.premiumPlan;

    let fedpaText = `PLANES DE FEDPA SEGUROS - DAÑOS A TERCEROS (precios actuales del portal):`;

    // Plan Básico
    fedpaText += `\n\nPLAN BÁSICO - Prima anual: $${bp.annualPremium}`;
    if (bp.installments.available) {
      fedpaText += `\nOpción de pago: ${bp.installments.payments} cuotas de $${bp.installments.amount} (total financiado: $${bp.installments.totalWithInstallments})`;
    }
    fedpaText += `\nCoberturas: ${formatCoverages(bp.coverages).join(' | ')}`;
    if (bp.endosoBenefits?.length) {
      fedpaText += `\nBeneficios del endoso (${bp.endoso}): ${bp.endosoBenefits.join(' | ')}`;
    }

    // Plan VIP/Premium
    fedpaText += `\n\nPLAN VIP - Prima anual: $${pp.annualPremium}`;
    if (pp.installments.available) {
      fedpaText += `\nOpción de pago: ${pp.installments.payments} cuotas de $${pp.installments.amount} (total financiado: $${pp.installments.totalWithInstallments})`;
    }
    fedpaText += `\nCoberturas: ${formatCoverages(pp.coverages).join(' | ')}`;
    if (pp.endosoBenefits?.length) {
      fedpaText += `\nBeneficios del endoso (${pp.endoso}): ${pp.endosoBenefits.join(' | ')}`;
    }

    // Try to enhance with live API benefits
    try {
      const FEDPA_USER = process.env.USUARIO_FEDPA;
      const FEDPA_CLAVE = process.env.CLAVE_FEDPA;
      if (FEDPA_USER && FEDPA_CLAVE) {
        const benRes = await fetch(
          `${FEDPA_API}/Polizas/consultar_beneficios_planes_externos?Usuario=${FEDPA_USER}&Clave=${FEDPA_CLAVE}&plan=426`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (benRes.ok) {
          const allBens = await benRes.json();
          if (Array.isArray(allBens) && allBens.length > 0) {
            const fabBens = allBens.filter((b: any) => b.ENDOSO === 'FAB').map((b: any) => b.BENEFICIOS).filter(Boolean);
            const favBens = allBens.filter((b: any) => b.ENDOSO === 'FAV').map((b: any) => b.BENEFICIOS).filter(Boolean);
            if (fabBens.length > 0) {
              fedpaText += `\n\nBeneficios detallados Endoso Básico (FAB) desde API: ${fabBens.join(' | ')}`;
            }
            if (favBens.length > 0) {
              fedpaText += `\nBeneficios detallados Endoso VIP (FAV) desde API: ${favBens.join(' | ')}`;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[CHAT] FEDPA benefits API enhancement failed (using constants):', e);
    }

    // Try to get live prices from FEDPA API to update if they changed
    try {
      const FEDPA_USER = process.env.USUARIO_FEDPA;
      const FEDPA_CLAVE = process.env.CLAVE_FEDPA;
      if (FEDPA_USER && FEDPA_CLAVE) {
        const baseParams = {
          Ano: new Date().getFullYear(), Uso: '10', CantidadPasajeros: 5,
          SumaAsegurada: '0', CodLimiteLesiones: '5', CodPlan: '426',
          CodMarca: '5', CodModelo: '10',
          Nombre: 'COTIZACION', Apellido: 'WEB',
          Cedula: '0-0-0', Telefono: '00000000', Email: 'cotizacion@web.com',
          Usuario: FEDPA_USER, Clave: FEDPA_CLAVE,
        };
        const [basicRes, premiumRes] = await Promise.all([
          fetch(`${FEDPA_API}/Polizas/get_cotizacion`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...baseParams, CodLimitePropiedad: '13', CodLimiteGastosMedico: '0', EndosoIncluido: 'S' }),
            signal: AbortSignal.timeout(10000),
          }),
          fetch(`${FEDPA_API}/Polizas/get_cotizacion`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...baseParams, CodLimitePropiedad: '8', CodLimiteGastosMedico: '23', EndosoIncluido: 'S' }),
            signal: AbortSignal.timeout(10000),
          }),
        ]);
        if (basicRes.ok && premiumRes.ok) {
          const basicData = await basicRes.json();
          const premiumData = await premiumRes.json();
          if (Array.isArray(basicData) && Array.isArray(premiumData)) {
            const OPCION_A_CODES = ['A', 'B', 'FAB', 'H-1', 'K6'];
            const OPCION_C_CODES = ['A', 'B', 'C', 'FAV', 'H-1', 'K6'];
            const basicAll = basicData.filter((c: any) => c.OPCION === 'A');
            const premiumAll = premiumData.filter((c: any) => c.OPCION === 'A');
            const basicPrima = basicAll.filter((c: any) => OPCION_A_CODES.includes(c.COBERTURA))
              .reduce((s: number, c: any) => s + (c.PRIMA_IMPUESTO || 0), 0);
            const premiumPrima = premiumAll.filter((c: any) => OPCION_C_CODES.includes(c.COBERTURA))
              .reduce((s: number, c: any) => s + (c.PRIMA_IMPUESTO || 0), 0);
            const liveBasic = Math.round(basicPrima);
            const livePremium = Math.round(premiumPrima);
            if (liveBasic > 0 && liveBasic !== bp.annualPremium) {
              fedpaText += `\n\n⚠️ NOTA: La API de FEDPA reporta precio básico actualizado: $${liveBasic} (en portal: $${bp.annualPremium}). Usa el precio de la API si difiere.`;
            }
            if (livePremium > 0 && livePremium !== pp.annualPremium) {
              fedpaText += `\n⚠️ NOTA: La API de FEDPA reporta precio VIP actualizado: $${livePremium} (en portal: $${pp.annualPremium}). Usa el precio de la API si difiere.`;
            }
            // Add detailed coverage breakdown from API
            const formatApiCovs = (allCovs: any[], codes: string[]) =>
              allCovs.filter((c: any) => codes.includes(c.COBERTURA)).map((c: any) =>
                `${c.DESCCOBERTURA}: límite ${c.LIMITE}, prima $${c.PRIMA_IMPUESTO}`
              );
            const apiBasicCovs = formatApiCovs(basicAll, OPCION_A_CODES);
            const apiPremiumCovs = formatApiCovs(premiumAll, OPCION_C_CODES);
            if (apiBasicCovs.length > 0) {
              fedpaText += `\n\nDesglose detallado Básico (desde API): ${apiBasicCovs.join(' | ')}`;
            }
            if (apiPremiumCovs.length > 0) {
              fedpaText += `\nDesglose detallado VIP (desde API): ${apiPremiumCovs.join(' | ')}`;
            }
            console.log(`[CHAT] FEDPA live API prices: basic=$${liveBasic}, premium=$${livePremium}`);
          }
        }
      }
    } catch (e) {
      console.warn('[CHAT] FEDPA live price fetch failed (using constants):', e);
    }

    parts.push(fedpaText);
    console.log(`[CHAT] FEDPA plans loaded (basic=$${bp.annualPremium}, vip=$${pp.annualPremium})`);
  }

  // ── INTERNACIONAL DE SEGUROS ──
  const isInsurer = AUTO_THIRD_PARTY_INSURERS.find(i => i.id === 'internacional');
  if (isInsurer) {
    const bp = isInsurer.basicPlan;
    const pp = isInsurer.premiumPlan;

    let isText = `PLANES DE INTERNACIONAL DE SEGUROS - DAÑOS A TERCEROS (precios actuales del portal):`;

    // Plan Básico (SOAT)
    isText += `\n\nPLAN BÁSICO (SOAT) - Prima anual: $${bp.annualPremium}`;
    isText += `\nPago: ${bp.installments.description || 'Solo al contado'}`;
    isText += `\nCoberturas: ${formatCoverages(bp.coverages).join(' | ')}`;
    if (bp.endosoBenefits?.length) {
      isText += `\nBeneficios: ${bp.endosoBenefits.join(' | ')}`;
    }

    // Plan Intermedio
    isText += `\n\nPLAN INTERMEDIO - Prima anual: $${pp.annualPremium}`;
    isText += `\nPago: ${pp.installments.description || 'Solo al contado'}`;
    isText += `\nCoberturas: ${formatCoverages(pp.coverages).join(' | ')}`;
    if (pp.endosoBenefits?.length) {
      isText += `\nBeneficios: ${pp.endosoBenefits.join(' | ')}`;
    }

    parts.push(isText);
    console.log(`[CHAT] Internacional plans loaded (basic=$${bp.annualPremium}, intermedio=$${pp.annualPremium})`);
  }

  // ── Note about other insurers ──
  const otherInsurers = AUTO_THIRD_PARTY_INSURERS.filter(i => i.id !== 'fedpa' && i.id !== 'internacional');
  if (otherInsurers.length > 0) {
    parts.push(`OTRAS ASEGURADORAS: ${otherInsurers.map(i => i.name).join(', ')}. Para información detallada de estas aseguradoras, contactar directamente.`);
  }

  parts.push(`NOTA: Estos son los planes de Daños a Terceros disponibles actualmente en nuestro portal. Los precios y coberturas se actualizan desde las APIs de las aseguradoras. Si el cliente necesita cotizar un plan diferente (cobertura completa, vida, etc.), dirigir a: https://portal.lideresenseguros.com/cotizadores`);

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
      || lower.includes('daños a terceros') || lower.includes('grua') || lower.includes('grúa')
      || lower.includes('asistencia') || lower.includes('endoso') || lower.includes('fedpa')
      || lower.includes('internacional') || lower.includes('seguro auto')
      || lower.includes('precio') || lower.includes('cotiz') || lower.includes('prima')
      || lower.includes('cuantas') || lower.includes('cuántas') || lower.includes('incluye')
      || lower.includes('economico') || lower.includes('económico') || lower.includes('barato')
      || lower.includes('comparar') || lower.includes('diferencia') || lower.includes('cuota')
      // Also trigger if recent conversation was about plans (follow-up questions)
      || (historyText.includes('fedpa') && (lower.includes('terceros') || lower.includes('basico') || lower.includes('básico') || lower.includes('premium') || lower.includes('cuota')))
      || (historyText.includes('internacional') && (lower.includes('terceros') || lower.includes('basico') || lower.includes('básico') || lower.includes('premium') || lower.includes('diferencia')))
      || (historyText.includes('plan') && (lower.includes('terceros') || lower.includes('cuantas') || lower.includes('cuántas') || lower.includes('diferencia')));

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
