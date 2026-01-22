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

import { createClient } from '@/lib/supabase/server';
import type { EmailClassificationResult } from '@/lib/vertex/vertexClient';
import { getCurrentAAMM } from '@/lib/timezone/time';

export interface CaseCreationInput {
  inboundEmailId: string;
  aiClassification: EmailClassificationResult;
  emailFrom: string;
  emailCc: string[];
  emailSubject: string;
}

export interface CaseCreationResult {
  success: boolean;
  caseId?: string;
  ticket?: string;
  action: 'created' | 'linked' | 'provisional' | 'error';
  message: string;
}

/**
 * Procesa un correo entrante y crea/vincula caso
 */
export async function processInboundEmail(
  input: CaseCreationInput
): Promise<CaseCreationResult> {
  const supabase = await createClient();

  try {
    // 1. Determinar broker asignado
    const brokerId = await determineBroker(
      supabase,
      input.aiClassification.broker_email_detected,
      input.emailFrom,
      input.emailCc
    );

    if (!brokerId) {
      return {
        success: false,
        action: 'error',
        message: 'No se pudo determinar broker asignado',
      };
    }

    // 2. Determinar master asignado por bucket
    const masterId = await determineMaster(
      supabase,
      input.aiClassification.ramo_bucket
    );

    // 3. Verificar si debe agruparse con caso existente
    const existingCaseId = await findExistingCase(
      supabase,
      input.emailSubject,
      input.emailFrom,
      brokerId
    );

    if (existingCaseId) {
      // VINCULAR a caso existente
      await linkEmailToCase(supabase, existingCaseId, input.inboundEmailId);
      
      return {
        success: true,
        caseId: existingCaseId,
        action: 'linked',
        message: 'Correo vinculado a caso existente',
      };
    }

    // 4. Crear nuevo caso
    const isProvisional = shouldBeProvisional(input.aiClassification);

    const caseData: any = {
      broker_id: brokerId,
      assigned_master_id: masterId,
      ramo_bucket: input.aiClassification.ramo_bucket,
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
    };

    const { data: newCase, error: caseError } = await supabase
      .from('cases')
      .insert(caseData)
      .select()
      .single();

    if (caseError || !newCase) {
      console.error('[CASE ENGINE] Error creating case:', caseError);
      return {
        success: false,
        action: 'error',
        message: `Error creando caso: ${caseError?.message}`,
      };
    }

    // 5. Vincular correo al caso
    await linkEmailToCase(supabase, newCase.id, input.inboundEmailId);

    // 6. Crear evento de historial
    await createHistoryEvent(supabase, newCase.id, 'created', {
      origin: 'email_ingestion',
      classification: input.aiClassification.ramo_bucket,
      confidence: input.aiClassification.confidence,
    });

    // 7. Generar ticket si NO es provisional
    let ticket: string | undefined;
    if (!isProvisional && canGenerateTicket(input.aiClassification)) {
      ticket = await generateTicket(supabase, newCase.id, input.aiClassification);
    }

    // 8. Audit log
    await createAuditLog(supabase, {
      action: 'CASE_CREATED',
      entity_type: 'case',
      entity_id: newCase.id,
      after: { caseId: newCase.id, ticket, estado: caseData.estado_simple },
    });

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
 * Busca caso existente para agrupar (24h)
 */
async function findExistingCase(
  supabase: any,
  subject: string,
  emailFrom: string,
  brokerId: string
): Promise<string | null> {
  // 1. Si subject contiene ticket, buscar por ticket
  const ticketMatch = subject.match(/\d{12,}/); // 12 dígitos
  if (ticketMatch) {
    const { data: caseByTicket } = await supabase
      .from('cases')
      .select('id')
      .eq('ticket', ticketMatch[0])
      .single();

    if (caseByTicket) {
      return caseByTicket.id;
    }
  }

  // 2. Buscar caso del mismo broker creado en últimas 24h con mismo remitente
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentCase } = await supabase
    .from('cases')
    .select('id, detected_broker_email')
    .eq('broker_id', brokerId)
    .gte('created_at', last24h)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (recentCase && recentCase.detected_broker_email === emailFrom) {
    return recentCase.id;
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
  await supabase.from('case_emails').insert({
    case_id: caseId,
    inbound_email_id: inboundEmailId,
    linked_by: 'system',
    visible_to_broker: true,
  });

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
  await supabase.from('security_audit_logs').insert({
    actor_type: 'system',
    action: data.action,
    entity_type: data.entity_type,
    entity_id: data.entity_id,
    before: data.before || null,
    after: data.after || null,
  });
}
