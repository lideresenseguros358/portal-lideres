'use server';

// =====================================================
// SERVER ACTIONS - TICKET GENERATION AND MANAGEMENT
// =====================================================

import { getSupabaseServer } from '@/lib/supabase/server';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/server';
import { validateTicketCodes, canGenerateTicket } from '@/lib/ticketing/ticket-generator';

interface GenerateTicketResult {
  ok: boolean;
  ticket?: string;
  error?: string;
}

/**
 * Genera un ticket para un caso
 * Solo se genera si tiene ramo_code, aseguradora_code y tramite_code
 */
export async function actionGenerateTicket(caseId: string): Promise<GenerateTicketResult> {
  const supabase = await getSupabaseServer();

  try {
    // Obtener caso actual
    const { data: currentCase, error: fetchError } = await supabase
      .from('cases')
      .select('id, ramo_code, aseguradora_code, tramite_code, section, ticket_ref')
      .eq('id', caseId)
      .single();

    if (fetchError || !currentCase) {
      return { ok: false, error: 'Caso no encontrado' };
    }

    // Validar que se puede generar ticket
    if (!canGenerateTicket(
      currentCase.ramo_code,
      currentCase.aseguradora_code,
      currentCase.tramite_code,
      currentCase.section
    )) {
      return { 
        ok: false, 
        error: 'El caso debe tener ramo, aseguradora y trámite definidos para generar ticket' 
      };
    }

    // Llamar función SQL para generar ticket
    const { data: ticketData, error: ticketError } = await supabase
      .rpc('generate_ticket_number', {
        p_ramo_code: currentCase.ramo_code!,
        p_aseguradora_code: currentCase.aseguradora_code!,
        p_tramite_code: currentCase.tramite_code!,
      });

    if (ticketError) {
      console.error('Error generating ticket:', ticketError);
      return { ok: false, error: 'Error al generar ticket' };
    }

    const newTicket = ticketData as string;

    // Actualizar caso con nuevo ticket
    const { error: updateError } = await supabase
      .from('cases')
      .update({
        ticket_ref: newTicket,
        ticket_generated_at: new Date().toISOString(),
        is_classified: true,
        classified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } satisfies TablesUpdate<'cases'>)
      .eq('id', caseId);

    if (updateError) {
      console.error('Error updating case with ticket:', updateError);
      return { ok: false, error: 'Error al actualizar caso con ticket' };
    }

    // Registrar en historial de tickets
    const { error: historyError } = await supabase
      .from('case_ticket_history')
      .insert({
        case_id: caseId,
        old_ticket: currentCase.ticket_ref,
        new_ticket: newTicket,
        reason: currentCase.ticket_ref ? 'RAMO_CHANGED' : 'INITIAL_GENERATION',
        metadata: {
          ramo_code: currentCase.ramo_code,
          aseguradora_code: currentCase.aseguradora_code,
          tramite_code: currentCase.tramite_code,
        },
      } satisfies TablesInsert<'case_ticket_history'>);

    if (historyError) {
      console.error('Error logging ticket history:', historyError);
      // No fallar por esto
    }

    return { ok: true, ticket: newTicket };
  } catch (error) {
    console.error('Unexpected error generating ticket:', error);
    return { ok: false, error: 'Error inesperado al generar ticket' };
  }
}

/**
 * Actualiza los códigos de catálogo de un caso y regenera ticket si es necesario
 */
export async function actionUpdateCaseCodes(
  caseId: string,
  ramoCode: string | null,
  aseguradoraCode: string | null,
  tramiteCode: string | null,
  regenerateTicket: boolean = true
): Promise<{ ok: boolean; ticket?: string; error?: string }> {
  const supabase = await getSupabaseServer();

  try {
    // Actualizar códigos
    const { error: updateError } = await supabase
      .from('cases')
      .update({
        ramo_code: ramoCode,
        aseguradora_code: aseguradoraCode,
        tramite_code: tramiteCode,
        updated_at: new Date().toISOString(),
      } satisfies TablesUpdate<'cases'>)
      .eq('id', caseId);

    if (updateError) {
      return { ok: false, error: 'Error al actualizar códigos' };
    }

    // Regenerar ticket si se solicitó y los códigos son válidos
    if (regenerateTicket && canGenerateTicket(ramoCode, aseguradoraCode, tramiteCode, 'RAMOS_GENERALES')) {
      return await actionGenerateTicket(caseId);
    }

    return { ok: true };
  } catch (error) {
    console.error('Error updating case codes:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

/**
 * Obtiene el historial de tickets de un caso
 */
export async function actionGetTicketHistory(caseId: string) {
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from('case_ticket_history')
    .select('*, profiles:changed_by(full_name, email)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

/**
 * Obtiene los logs de seguridad de un caso (solo Master)
 */
export async function actionGetSecurityLogs(caseId: string) {
  const supabase = await getSupabaseServer();

  // Verificar que el usuario es master
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'master') {
    return { ok: false, error: 'Solo los masters pueden ver los logs de seguridad' };
  }

  const { data, error } = await supabase
    .from('case_security_logs')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

/**
 * Reabre un caso aplazado
 */
export async function actionReopenAplazadoCase(
  caseId: string,
  createNewTicket: boolean = true
): Promise<{ ok: boolean; ticket?: string; error?: string }> {
  const supabase = await getSupabaseServer();

  try {
    // Llamar función SQL para reapertura
    const { data: newTicket, error: reopenError } = await supabase
      .rpc('reopen_aplazado_case', {
        p_case_id: caseId,
        p_create_new_ticket: createNewTicket,
      });

    if (reopenError) {
      console.error('Error reopening case:', reopenError);
      return { ok: false, error: 'Error al reabrir caso' };
    }

    return { ok: true, ticket: newTicket as string };
  } catch (error) {
    console.error('Unexpected error reopening case:', error);
    return { ok: false, error: 'Error inesperado al reabrir caso' };
  }
}

/**
 * Pausa o reanuda el SLA de un caso
 */
export async function actionToggleSLAPause(
  caseId: string,
  pause: boolean,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseServer();

  try {
    const { error } = await supabase.rpc('toggle_case_sla_pause', {
      p_case_id: caseId,
      p_pause: pause,
      p_reason: reason || undefined,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error('Error toggling SLA pause:', error);
    return { ok: false, error: 'Error al pausar/reanudar SLA' };
  }
}

/**
 * Cierra un caso como aprobado (requiere número de póliza si es emisión)
 */
export async function actionCloseCaseApproved(
  caseId: string,
  finalPolicyNumber?: string,
  notes?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseServer();

  try {
    const updateData: TablesUpdate<'cases'> = {
      status_v2: 'CERRADO_APROBADO',
      final_policy_number: finalPolicyNumber || null,
      notes: notes ? `${notes}\n[Cerrado: ${new Date().toLocaleString()}]` : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('cases')
      .update(updateData)
      .eq('id', caseId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error('Error closing case:', error);
    return { ok: false, error: 'Error al cerrar caso' };
  }
}

/**
 * Cierra un caso como rechazado (requiere razón)
 */
export async function actionCloseCaseRejected(
  caseId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseServer();

  if (!reason || reason.trim().length < 10) {
    return { ok: false, error: 'La razón debe tener al menos 10 caracteres' };
  }

  try {
    const { error } = await supabase
      .from('cases')
      .update({
        status_v2: 'CERRADO_RECHAZADO',
        notes: `${reason}\n[Cerrado: ${new Date().toLocaleString()}]`,
        updated_at: new Date().toISOString(),
      } satisfies TablesUpdate<'cases'>)
      .eq('id', caseId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error('Error closing case:', error);
    return { ok: false, error: 'Error al cerrar caso' };
  }
}

/**
 * Aplaza un caso por N meses
 */
export async function actionAplazarCase(
  caseId: string,
  months: number,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseServer();

  if (months < 1 || months > 6) {
    return { ok: false, error: 'Los meses deben estar entre 1 y 6' };
  }

  if (!reason || reason.trim().length < 10) {
    return { ok: false, error: 'La razón debe tener al menos 10 caracteres' };
  }

  try {
    const postponedUntil = new Date();
    postponedUntil.setMonth(postponedUntil.getMonth() + months);

    // Fecha de notificación: 1 semana antes
    const notifyAt = new Date(postponedUntil);
    notifyAt.setDate(notifyAt.getDate() - 7);

    const { error } = await supabase
      .from('cases')
      .update({
        status_v2: 'APLAZADO',
        postponed_until: postponedUntil.toISOString(),
        aplazar_months: months,
        aplazar_notify_at: notifyAt.toISOString(),
        aplazar_reason: reason,
        updated_at: new Date().toISOString(),
      } satisfies TablesUpdate<'cases'>)
      .eq('id', caseId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error('Error aplazando case:', error);
    return { ok: false, error: 'Error al aplazar caso' };
  }
}
