/**
 * PENDIENTES AI PERSISTENCE
 * ==========================
 * Save/query Vertex AI classification results to pend_ai_classifications table.
 * Handles auto-apply vs suggest-only logic based on confidence thresholds.
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { PendientesClassificationResult } from './pendientesClassifier';

const AUTO_APPLY_THRESHOLD = 0.80;

export interface SaveClassificationParams {
  caseId: string | null;
  messageId: string;
  result: PendientesClassificationResult;
}

/**
 * Persist an AI classification result.
 */
export async function saveAiClassification(params: SaveClassificationParams): Promise<string | null> {
  const supabase = getSupabaseAdmin() as any;

  const { data, error } = await supabase
    .from('pend_ai_classifications')
    .insert({
      case_id: params.caseId,
      message_id: params.messageId,
      json_result: params.result,
      applied: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[PEND-AI-PERSIST] Insert error:', error.message);
    return null;
  }

  return data?.id || null;
}

/**
 * Mark a classification as applied (auto or manual).
 */
export async function markClassificationApplied(
  classificationId: string,
  userId: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin() as any;

  await supabase
    .from('pend_ai_classifications')
    .update({
      applied: true,
      applied_by: userId,
      applied_at: new Date().toISOString(),
    })
    .eq('id', classificationId);
}

/**
 * Get the latest unapplied classification for a case.
 */
export async function getLatestSuggestion(caseId: string): Promise<{
  id: string;
  json_result: PendientesClassificationResult;
  created_at: string;
} | null> {
  const supabase = getSupabaseAdmin() as any;

  const { data } = await supabase
    .from('pend_ai_classifications')
    .select('id, json_result, created_at')
    .eq('case_id', caseId)
    .eq('applied', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data || null;
}

/**
 * Determine whether to auto-apply a status suggestion.
 */
export function shouldAutoApplyStatus(result: PendientesClassificationResult): boolean {
  return result.status_confidence >= AUTO_APPLY_THRESHOLD;
}

/**
 * Auto-apply status change to a case if confidence is high enough.
 * Returns true if applied, false if only suggested.
 */
export async function applyStatusIfConfident(
  caseId: string,
  classificationId: string,
  result: PendientesClassificationResult,
): Promise<{ applied: boolean; newStatus: string | null }> {
  if (!shouldAutoApplyStatus(result)) {
    return { applied: false, newStatus: null };
  }

  const supabase = getSupabaseAdmin() as any;

  // Update case status
  const { error } = await supabase
    .from('cases')
    .update({
      estado_simple: mapSuggestedStatusToEstado(result.suggested_status),
      ai_classification: result,
      ai_confidence: result.confidence,
    })
    .eq('id', caseId);

  if (error) {
    console.error('[PEND-AI] Auto-apply status error:', error.message);
    return { applied: false, newStatus: null };
  }

  // Mark classification as applied
  await markClassificationApplied(classificationId, null);

  // Log history event
  await supabase.from('case_history_events').insert({
    case_id: caseId,
    event_type: 'ai_status_auto_applied',
    payload: {
      new_status: result.suggested_status,
      confidence: result.status_confidence,
      rationale: result.rationale,
      classification_id: classificationId,
    },
    created_by_role: 'system',
    visible_to_broker: true,
  });

  return { applied: true, newStatus: result.suggested_status };
}

/**
 * Map the AI suggested_status to the EstadoSimple enum used in the cases table.
 */
function mapSuggestedStatusToEstado(suggested: string): string {
  const map: Record<string, string> = {
    pendiente: 'Nuevo',
    en_proceso: 'En proceso',
    en_espera_cliente: 'Pendiente cliente',
    en_espera_aseguradora: 'En proceso',
    emitido: 'Enviado',
    cerrado: 'Cerrado aprobado',
    rechazado: 'Cerrado rechazado',
    aplazado: 'Aplazado',
  };
  return map[suggested] || 'Nuevo';
}
