/**
 * HELPERS DE CORREOS PARA MÓDULO PENDIENTES
 * ==========================================
 * Funciones para enviar correos desde el módulo de Pendientes
 * SMTP: tramites@lideresenseguros.com
 */

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';
import { generateDedupeKey } from '@/server/email/dedupe';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Notificar creación de caso
 */
export async function notifyCaseCreated(caseId: string): Promise<void> {
  const { data: caso, error } = await supabase
    .from('cases')
    .select(`
      id,
      ticket,
      client_name,
      ctype,
      ramo_code,
      estado_simple,
      notes,
      sla_due_date,
      created_at,
      broker_id,
      aseguradora_code,
      brokers!inner(name, email),
      insurers(name)
    `)
    .eq('id', caseId)
    .single();

  if (error || !caso) {
    console.error('[PENDIENTES] Error fetching case:', error);
    return;
  }

  const broker = caso.brokers as any;
  const insurer = caso.insurers as any;

  const html = renderEmailTemplate('pendienteCreated', {
    brokerName: broker.name,
    ticket: caso.ticket,
    clientName: caso.client_name,
    caseType: caso.ctype,
    ramo: caso.ramo_code || 'N/A',
    status: caso.estado_simple,
    notes: caso.notes,
    slaDate: caso.sla_due_date,
    insurerName: insurer?.name || 'N/A',
    createdAt: caso.created_at,
    portalUrl: appUrl,
  });

  await sendEmail({
    to: broker.email,
    subject: `📋 Nuevo caso asignado: ${caso.ticket}`,
    html,
    fromType: 'TRAMITES',
    template: 'pendienteCreated',
    dedupeKey: generateDedupeKey(broker.email, 'pendienteCreated', caseId),
    metadata: { caseId, brokerId: caso.broker_id },
  });
}

/**
 * Notificar actualización de caso
 */
export async function notifyCaseUpdated(caseId: string, changes: any[]): Promise<void> {
  const { data: caso, error } = await supabase
    .from('cases')
    .select(`
      id,
      ticket,
      client_name,
      estado_simple,
      updated_at,
      broker_id,
      brokers!inner(name, email)
    `)
    .eq('id', caseId)
    .single();

  if (error || !caso) return;

  const broker = caso.brokers as any;

  const html = renderEmailTemplate('pendienteUpdated', {
    brokerName: broker.name,
    ticket: caso.ticket,
    clientName: caso.client_name,
    newStatus: caso.estado_simple,
    updatedBy: 'Sistema', // O pasar el usuario que actualizó
    updatedAt: caso.updated_at,
    changes,
    portalUrl: appUrl,
  });

  await sendEmail({
    to: broker.email,
    subject: `🔄 Caso actualizado: ${caso.ticket}`,
    html,
    fromType: 'TRAMITES',
    template: 'pendienteUpdated',
    dedupeKey: generateDedupeKey(broker.email, 'pendienteUpdated', `${caseId}-${caso.updated_at}`),
    metadata: { caseId, brokerId: caso.broker_id, changes },
  });
}

/**
 * Notificar cierre de caso (aprobado)
 */
export async function notifyCaseClosedApproved(caseId: string, closingData: any): Promise<void> {
  const { data: caso, error } = await supabase
    .from('cases')
    .select(`
      id,
      ticket,
      client_name,
      ctype,
      ramo_code,
      premium,
      final_policy_number,
      broker_id,
      brokers!inner(name, email),
      insurers(name)
    `)
    .eq('id', caseId)
    .single();

  if (error || !caso) return;

  const broker = caso.brokers as any;
  const insurer = caso.insurers as any;

  const html = renderEmailTemplate('pendienteClosedApproved', {
    brokerName: broker.name,
    ticket: caso.ticket,
    clientName: caso.client_name,
    caseType: caso.ctype,
    insurerName: insurer?.name || 'N/A',
    closedBy: closingData.closedBy || 'Sistema',
    closedAt: closingData.closedAt || new Date().toISOString(),
    policyNumber: caso.final_policy_number,
    closingNotes: closingData.notes,
    premium: caso.premium,
    ramo: caso.ramo_code,
    resolutionTime: closingData.resolutionTime || 'N/A',
    portalUrl: appUrl,
  });

  await sendEmail({
    to: broker.email,
    subject: `✅ Caso aprobado: ${caso.ticket}`,
    html,
    fromType: 'TRAMITES',
    template: 'pendienteClosedApproved',
    dedupeKey: generateDedupeKey(broker.email, 'pendienteClosedApproved', caseId),
    metadata: { caseId, brokerId: caso.broker_id, status: 'approved' },
  });
}

/**
 * Notificar cierre de caso (rechazado)
 */
export async function notifyCaseClosedRejected(caseId: string, closingData: any): Promise<void> {
  const { data: caso, error } = await supabase
    .from('cases')
    .select(`
      id,
      ticket,
      client_name,
      ctype,
      broker_id,
      brokers!inner(name, email),
      insurers(name)
    `)
    .eq('id', caseId)
    .single();

  if (error || !caso) return;

  const broker = caso.brokers as any;
  const insurer = caso.insurers as any;

  const html = renderEmailTemplate('pendienteClosedRejected', {
    brokerName: broker.name,
    ticket: caso.ticket,
    clientName: caso.client_name,
    caseType: caso.ctype,
    insurerName: insurer?.name || 'N/A',
    closedBy: closingData.closedBy || 'Sistema',
    closedAt: closingData.closedAt || new Date().toISOString(),
    reason: closingData.reason,
    closingNotes: closingData.notes,
    portalUrl: appUrl,
  });

  await sendEmail({
    to: broker.email,
    subject: `❌ Caso rechazado: ${caso.ticket}`,
    html,
    fromType: 'TRAMITES',
    template: 'pendienteClosedRejected',
    dedupeKey: generateDedupeKey(broker.email, 'pendienteClosedRejected', caseId),
    metadata: { caseId, brokerId: caso.broker_id, status: 'rejected' },
  });
}

/**
 * Notificar aplazamiento de caso
 */
export async function notifyCasePostponed(caseId: string, postponeData: any): Promise<void> {
  const { data: caso, error } = await supabase
    .from('cases')
    .select(`
      id,
      ticket,
      client_name,
      aplazado_until,
      aplazado_months,
      aplazar_reason,
      broker_id,
      brokers!inner(name, email)
    `)
    .eq('id', caseId)
    .single();

  if (error || !caso) return;

  const broker = caso.brokers as any;

  const html = renderEmailTemplate('pendienteAplazado', {
    brokerName: broker.name,
    ticket: caso.ticket,
    clientName: caso.client_name,
    aplazadoUntil: caso.aplazado_until,
    aplazadoMonths: caso.aplazado_months,
    reason: caso.aplazar_reason || postponeData.reason,
    aplazadoBy: postponeData.aplazadoBy || 'Sistema',
    portalUrl: appUrl,
  });

  await sendEmail({
    to: broker.email,
    subject: `⏸️ Caso aplazado: ${caso.ticket}`,
    html,
    fromType: 'TRAMITES',
    template: 'pendienteAplazado',
    dedupeKey: generateDedupeKey(broker.email, 'pendienteAplazado', `${caseId}-${caso.aplazado_until}`),
    metadata: { caseId, brokerId: caso.broker_id, aplazadoUntil: caso.aplazado_until },
  });
}
