/**
 * CASE ENGINE - Motor de Asignación y Creación de Casos
 * ======================================================
 * Lógica central para:
 * - Asignación de broker y master
 * - Agrupación con casos existentes (24h)
 * - Creación de casos (clasificados o "Sin clasificar")
 * - Vinculación de correos
 * - Generación de tickets posicionales
 * - Tracking de historial y audit logs
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { EmailClassificationResult } from '@/lib/vertex/vertexClient';
import type { PendientesClassificationResult } from '@/lib/vertex/pendientesClassifier';
import { getCurrentAAMM } from '@/lib/timezone/time';
import { notifyCaseCreated } from '@/lib/email/pendientes';
import { logImapDebug } from '@/lib/debug/imapLogger';

export interface CaseCreationInput {
  inboundEmailId: string;
  aiClassification: EmailClassificationResult;
  emailFrom: string;
  emailCc: string[];
  emailSubject: string;
  /** Normalized subject (Re:/Fwd: stripped) for grouping */
  emailSubjectNormalized?: string;
  /** In-Reply-To header for thread matching */
  inReplyTo?: string | null;
  /** References header for thread matching */
  threadReferences?: string | null;
  /** Enhanced Pendientes classification (optional — used for ticket exceptions) */
  pendientesClassification?: PendientesClassificationResult;
}

export interface CaseCreationResult {
  success: boolean;
  caseId?: string;
  ticket?: string;
  action: 'created' | 'linked' | 'provisional' | 'error';
  message: string;
}

/**
 * Normaliza subject para agrupar: quita Re:/Fwd:/FW:, números de ticket,
 * espacios extra, y pasa a minúsculas.
 */
function normalizeSubjectForGrouping(subject: string): string {
  if (!subject) return '';
  return subject
    .replace(/^(re|fwd?|fw)\s*:\s*/gi, '')  // Remove Re: Fwd: FW:
    .replace(/\s+/g, ' ')                    // Collapse whitespace
    .trim()
    .toLowerCase();
}

/**
 * Procesa un correo entrante y crea/vincula caso
 */
export async function processInboundEmail(
  input: CaseCreationInput
): Promise<CaseCreationResult> {
  const supabase = getSupabaseAdmin();

  try {
    // 1. Determinar broker asignado (puede ser null para externos)
    const brokerId = await determineBroker(
      supabase,
      input.aiClassification.broker_email_detected,
      input.emailFrom,
      input.emailCc
    );

    await logImapDebug({
      inboundEmailId: input.inboundEmailId,
      stage: 'broker_detect',
      status: brokerId ? 'success' : 'warning',
      message: brokerId ? 'Broker detectado' : 'Sin broker detectado - cliente externo',
      payload: {
        broker_id: brokerId,
        detected_from_ai: input.aiClassification.broker_email_detected,
        email_from: input.emailFrom,
      },
    });

    // CORRECCIÓN: Permitir casos sin broker (clientes externos)
    // Solo generar warning pero NO fallar

    // 2. Determinar master asignado por bucket
    const masterId = await determineMaster(
      supabase,
      input.aiClassification.ramo_bucket
    );

    // 3. Verificar si debe agruparse con caso existente
    //    Busca por: thread headers, ticket en subject, subject normalizado, o mismo remitente reciente
    const existingCaseId = await findExistingCase(
      supabase,
      input.emailSubject,
      input.emailSubjectNormalized || normalizeSubjectForGrouping(input.emailSubject),
      input.emailFrom,
      brokerId,
      input.inReplyTo || null,
      input.threadReferences || null,
    );

    if (existingCaseId) {
      // VINCULAR a caso existente
      await linkEmailToCase(supabase, existingCaseId, input.inboundEmailId);

      // Update inbound_email status immediately
      // @ts-ignore - tabla nueva
      await supabase
        .from('inbound_emails')
        .update({ processed_status: 'linked', processed_at: new Date().toISOString() })
        .eq('id', input.inboundEmailId);

      await logImapDebug({
        inboundEmailId: input.inboundEmailId,
        caseId: existingCaseId,
        stage: 'case_link',
        status: 'success',
        message: `Correo vinculado a caso existente ${existingCaseId}`,
        payload: {
          strategy: 'findExistingCase',
          inReplyTo: input.inReplyTo,
          subjectNormalized: input.emailSubjectNormalized,
        },
      });

      return {
        success: true,
        caseId: existingCaseId,
        action: 'linked',
        message: 'Correo vinculado a caso existente',
      };
    }

    // 4. Crear nuevo caso
    const isProvisional = shouldBeProvisional(input.aiClassification);

    // Map ramo_bucket to section enum so cases appear in actionGetCases
    const sectionFromBucket = (bucket: string): string => {
      if (bucket === 'vida_assa') return 'VIDA_ASSA';
      if (bucket === 'ramos_generales') return 'RAMOS_GENERALES';
      if (bucket === 'ramo_personas') return 'OTROS_PERSONAS';
      return 'SIN_CLASIFICAR';
    };

    // Use pendientesClassification for richer data when available
    const pend = input.pendientesClassification;
    // Prefer pendientes ramo_bucket if confidence is decent (>= 0.5)
    const effectiveBucket = (pend && pend.confidence >= 0.5 && pend.ramo_bucket !== 'desconocido')
      ? pend.ramo_bucket
      : input.aiClassification.ramo_bucket;

    // Map case_type to management_type label
    const caseTypeToManagement = (ct: string): string => {
      const map: Record<string, string> = {
        emision: 'Emisión',
        reclamo: 'Reclamo',
        modificacion: 'Modificación',
        cambio_corredor: 'Cambio de Corredor',
        cotizacion: 'Cotización',
        cancelacion: 'Cancelación',
        rehabilitacion: 'Rehabilitación',
        otro: 'Otro',
      };
      return map[ct] || ct || '';
    };

    const caseData: any = {
      broker_id: brokerId || null, // Permitir null para externos
      assigned_master_id: masterId,
      section: isProvisional ? 'SIN_CLASIFICAR' : sectionFromBucket(effectiveBucket || ''),
      ramo_bucket: effectiveBucket || input.aiClassification.ramo_bucket,
      ramo_code: input.aiClassification.ramo_code,
      aseguradora_code: input.aiClassification.aseguradora_code,
      tramite_code: input.aiClassification.tramite_code,
      tipo_poliza: input.aiClassification.tipo_poliza,
      estado_simple: isProvisional ? 'Sin clasificar' : 'Nuevo',
      ai_classification: input.aiClassification,
      ai_confidence: input.aiClassification.confidence,
      missing_fields: input.aiClassification.missing_fields,
      special_flags: input.aiClassification.case_special_flag
        ? [input.aiClassification.case_special_flag]
        : [],
      detected_broker_email: input.aiClassification.broker_email_detected,
      // Populate from AI-detected entities
      client_name: pend?.detected_entities?.client_name || null,
      national_id: pend?.detected_entities?.cedula || null,
      management_type: pend ? caseTypeToManagement(pend.case_type) : null,
      ctype: pend?.case_type || null,
      policy_number: pend?.policy_number || null,
    };

    const { data: newCase, error: caseError } = await supabase
      .from('cases')
      .insert(caseData)
      .select()
      .single();

    if (caseError || !newCase) {
      console.error('[CASE ENGINE] Error creating case:', caseError);
      await logImapDebug({
        inboundEmailId: input.inboundEmailId,
        stage: 'case_create',
        status: 'error',
        message: 'Error al insertar caso en BD',
        errorDetail: caseError?.message,
      });
      return {
        success: false,
        action: 'error',
        message: `Error creando caso: ${caseError?.message}`,
      };
    }

    // 5. Vincular correo al caso
    await linkEmailToCase(supabase, newCase.id, input.inboundEmailId);

    await logImapDebug({
      inboundEmailId: input.inboundEmailId,
      caseId: newCase.id,
      stage: 'case_link',
      status: 'success',
      message: 'Correo vinculado a caso',
    });

    // 6. Crear evento de historial
    await createHistoryEvent(supabase, newCase.id, 'created', {
      origin: 'email_ingestion',
      classification: input.aiClassification.ramo_bucket,
      confidence: input.aiClassification.confidence,
    });

    // 7. Generar ticket si NO es provisional y NO es excepción de ticket
    let ticket: string | undefined;
    const ticketException = input.pendientesClassification?.ticket_exception_reason || null;
    const ticketRequired = input.pendientesClassification?.ticket_required ?? true;

    if (!isProvisional && ticketRequired && canGenerateTicket(input.aiClassification)) {
      ticket = await generateTicket(supabase, newCase.id, input.aiClassification);
    } else if (ticketException) {
      // Log the ticket exception (ASSA Vida Regular / ASSA Salud)
      console.log(`[CASE ENGINE] Ticket exception: ${ticketException} — case ${newCase.id}`);
      await createHistoryEvent(supabase, newCase.id, 'ticket_exception', {
        reason: ticketException,
        ticket_required: false,
      });
      // Store special flag
      await supabase
        .from('cases')
        .update({
          special_flags: [...(caseData.special_flags || []), `no_ticket:${ticketException}`],
        })
        .eq('id', newCase.id);
    }

    // 8. Audit log
    await createAuditLog(supabase, {
      action: 'CASE_CREATED',
      entity_type: 'case',
      entity_id: newCase.id,
      after: { caseId: newCase.id, ticket, estado: caseData.estado_simple },
    });

    // 9. Enviar notificación por correo (solo si no es provisional)
    if (!isProvisional) {
      try {
        await notifyCaseCreated(newCase.id);
      } catch (emailError) {
        console.error('[CASE ENGINE] Error sending email notification:', emailError);
        // No fallar la creación del caso si el correo falla
      }
    }

    return {
      success: true,
      caseId: newCase.id,
      ticket,
      action: isProvisional ? 'provisional' : 'created',
      message: isProvisional
        ? 'Caso provisional creado (requiere clasificación)'
        : 'Caso creado exitosamente',
    };
  } catch (err: any) {
    console.error('[CASE ENGINE] Unexpected error:', err);
    return {
      success: false,
      action: 'error',
      message: err.message || 'Error inesperado',
    };
  }
}

/**
 * Determina broker asignado
 * Prioridad: AI detected > From/CC match > Error
 */
async function determineBroker(
  supabase: any,
  aiDetectedEmail: string | null,
  emailFrom: string,
  emailCc: string[]
): Promise<string | null> {
  // Prioridad 1: Email detectado por AI
  if (aiDetectedEmail) {
    const { data: broker } = await supabase
      .from('profiles')
      .select('id, role')
      .ilike('email', aiDetectedEmail.trim())
      .single();

    if (broker && broker.role === 'broker') {
      return broker.id;
    }
  }

  // Prioridad 2: Remitente es broker
  const { data: fromBroker } = await supabase
    .from('profiles')
    .select('id, role')
    .ilike('email', emailFrom.trim())
    .single();

  if (fromBroker && fromBroker.role === 'broker') {
    return fromBroker.id;
  }

  // Prioridad 3: CC contiene broker
  for (const ccEmail of emailCc) {
    const { data: ccBroker } = await supabase
      .from('profiles')
      .select('id, role')
      .ilike('email', ccEmail.trim())
      .single();

    if (ccBroker && ccBroker.role === 'broker') {
      return ccBroker.id;
    }
  }

  // No se pudo determinar broker
  return null;
}

/**
 * Determina master asignado según bucket (con soporte de vacaciones)
 */
async function determineMaster(
  supabase: any,
  ramoBucket: string
): Promise<string | null> {
  // Mapear bucket a configuración
  let configBucket: string;
  if (ramoBucket === 'vida_assa' || ramoBucket === 'ramo_personas') {
    configBucket = 'vida_personas';
  } else if (ramoBucket === 'ramos_generales') {
    configBucket = 'ramos_generales';
  } else {
    // Desconocido => default vida_personas
    configBucket = 'vida_personas';
  }

  const { data: config } = await supabase
    .from('master_routing_config')
    .select('effective_master_user_id')
    .eq('bucket', configBucket)
    .single();

  return config?.effective_master_user_id || null;
}

/**
 * Busca caso existente para agrupar un correo entrante.
 *
 * Estrategia de búsqueda (por prioridad):
 *   1. Thread matching: In-Reply-To / References apuntan a un message_id ya vinculado
 *   2. Ticket en subject: un ticket posicional (12+ dígitos) referenciado
 *   3. Subject normalizado: mismo subject base en un caso activo (ventana 30 días)
 *   4. Mismo remitente + broker reciente (48h) como fallback
 */
async function findExistingCase(
  supabase: any,
  subject: string,
  subjectNormalized: string,
  emailFrom: string,
  brokerId: string | null,
  inReplyTo: string | null,
  threadReferences: string | null,
): Promise<string | null> {

  // ── 1. THREAD MATCHING (In-Reply-To / References) ──
  // If the email is a reply, its In-Reply-To or References header points to
  // a previous message_id that should already be linked to a case via case_emails.
  const refIds: string[] = [];
  if (inReplyTo) refIds.push(inReplyTo.trim());
  if (threadReferences) {
    // References header is space-separated list of message-ids
    const refs = threadReferences.split(/\s+/).map(r => r.trim()).filter(Boolean);
    for (const r of refs) {
      if (!refIds.includes(r)) refIds.push(r);
    }
  }

  if (refIds.length > 0) {
    // Find inbound_emails matching those message_ids
    // @ts-ignore - tabla nueva
    const { data: linkedEmails } = await supabase
      .from('inbound_emails')
      .select('id')
      .in('message_id', refIds)
      .limit(10);

    if (linkedEmails && linkedEmails.length > 0) {
      const emailIds = linkedEmails.map((e: any) => e.id);
      // Find the case linked to any of those emails
      // @ts-ignore - tabla nueva
      const { data: caseLink } = await supabase
        .from('case_emails')
        .select('case_id')
        .in('inbound_email_id', emailIds)
        .limit(1)
        .single();

      if (caseLink?.case_id) {
        // Verify the case is still active (not deleted)
        const { data: activeCase } = await supabase
          .from('cases')
          .select('id')
          .eq('id', caseLink.case_id)
          .neq('is_deleted', true)
          .single();

        if (activeCase) {
          console.log(`[CASE ENGINE] Thread match: linked to case ${activeCase.id} via In-Reply-To/References`);
          return activeCase.id;
        }
      }
    }
  }

  // ── 2. TICKET EN SUBJECT ──
  const ticketMatch = subject.match(/\d{12,}/); // 12+ digit positional ticket
  if (ticketMatch) {
    const { data: caseByTicket } = await supabase
      .from('cases')
      .select('id')
      .eq('ticket', ticketMatch[0])
      .neq('is_deleted', true)
      .single();

    if (caseByTicket) {
      console.log(`[CASE ENGINE] Ticket match: linked to case ${caseByTicket.id} via ticket ${ticketMatch[0]}`);
      return caseByTicket.id;
    }
  }

  // ── 3. SUBJECT NORMALIZADO (same base subject in active case, 30-day window) ──
  if (subjectNormalized && subjectNormalized.length > 5) {
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Find inbound_emails with matching normalized subject linked to a case
    // Use ilike for case-insensitive comparison; escape LIKE wildcards
    const escapedSubject = subjectNormalized.replace(/%/g, '\\%').replace(/_/g, '\\_');
    // @ts-ignore - tabla nueva
    const { data: subjectMatches } = await supabase
      .from('inbound_emails')
      .select('id, subject_normalized')
      .ilike('subject_normalized', escapedSubject)
      .gte('date_sent', last30d)
      .eq('processed_status', 'linked')
      .order('date_sent', { ascending: false })
      .limit(5);

    if (subjectMatches && subjectMatches.length > 0) {
      const matchedIds = subjectMatches.map((e: any) => e.id);
      // @ts-ignore - tabla nueva
      const { data: caseLinkBySubject } = await supabase
        .from('case_emails')
        .select('case_id')
        .in('inbound_email_id', matchedIds)
        .limit(1)
        .single();

      if (caseLinkBySubject?.case_id) {
        // Verify the case is still active
        const { data: activeCase } = await supabase
          .from('cases')
          .select('id')
          .eq('id', caseLinkBySubject.case_id)
          .neq('is_deleted', true)
          .single();

        if (activeCase) {
          console.log(`[CASE ENGINE] Subject match: linked to case ${activeCase.id} via normalized subject "${subjectNormalized}"`);
          return activeCase.id;
        }
      }
    }
  }

  // ── 4. SAME SENDER + BROKER (48h fallback) ──
  if (brokerId) {
    const last48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: recentCase } = await supabase
      .from('cases')
      .select('id, detected_broker_email')
      .eq('broker_id', brokerId)
      .gte('created_at', last48h)
      .neq('is_deleted', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentCase && recentCase.detected_broker_email === emailFrom) {
      console.log(`[CASE ENGINE] Recent broker match: linked to case ${recentCase.id} (same sender within 48h)`);
      return recentCase.id;
    }
  }

  return null;
}

/**
 * Vincula correo a caso
 */
async function linkEmailToCase(
  supabase: any,
  caseId: string,
  inboundEmailId: string
): Promise<void> {
  // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
  await supabase.from('case_emails').insert({
    case_id: caseId,
    inbound_email_id: inboundEmailId,
    linked_by: 'system',
    visible_to_broker: true,
  });

  // Touch the case's updated_at so it stays fresh in listings
  await supabase
    .from('cases')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', caseId);

  // Crear evento de historial
  await createHistoryEvent(supabase, caseId, 'email_linked', {
    email_id: inboundEmailId,
  });
}

/**
 * Determina si caso debe ser provisional
 */
function shouldBeProvisional(ai: EmailClassificationResult): boolean {
  const threshold = Number(process.env.VERTEX_CONFIDENCE_THRESHOLD) || 0.72;
  
  if (ai.confidence < threshold) return true;
  if (ai.missing_fields.includes('ramo')) return true;
  if (ai.missing_fields.includes('aseguradora')) return true;
  if (ai.missing_fields.includes('tramite')) return true;
  
  return false;
}

/**
 * Verifica si se puede generar ticket
 */
function canGenerateTicket(ai: EmailClassificationResult): boolean {
  return !!(ai.ramo_code && ai.aseguradora_code && ai.tramite_code);
}

/**
 * Genera ticket posicional y actualiza caso
 */
async function generateTicket(
  supabase: any,
  caseId: string,
  ai: EmailClassificationResult
): Promise<string> {
  const aamm = getCurrentAAMM();
  
  const { data: ticketData } = await supabase.rpc('generate_next_ticket', {
    p_aamm: aamm,
    p_ramo_code: ai.ramo_code,
    p_aseg_code: ai.aseguradora_code,
    p_tramite_code: ai.tramite_code,
  });

  const ticket = ticketData as string;

  // Actualizar caso con ticket
  await supabase
    .from('cases')
    .update({ ticket })
    .eq('id', caseId);

  // Evento de historial
  await createHistoryEvent(supabase, caseId, 'ticket_generated', { ticket });

  return ticket;
}

/**
 * Crea evento de historial
 */
async function createHistoryEvent(
  supabase: any,
  caseId: string,
  eventType: string,
  payload: any
): Promise<void> {
  await supabase.from('case_history_events').insert({
    case_id: caseId,
    event_type: eventType,
    payload,
    created_by_role: 'system',
    visible_to_broker: true,
  });
}

/**
 * Crea audit log
 */
async function createAuditLog(
  supabase: any,
  data: {
    action: string;
    entity_type: string;
    entity_id: string;
    before?: any;
    after?: any;
  }
): Promise<void> {
  // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
  await supabase.from('security_audit_logs').insert({
    actor_type: 'system',
    action: data.action,
    entity_type: data.entity_type,
    entity_id: data.entity_id,
    before: data.before || null,
    after: data.after || null,
  });
}
