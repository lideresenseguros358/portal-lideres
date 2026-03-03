/**
 * API: POST /api/pendientes/casos/[id]/emitido-flow
 * ===================================================
 * Handles the "Emitido → Preliminar BD" transition:
 *   1. Validates policy_number (required)
 *   2. Updates case estado_simple to 'Enviado' (Emitido)
 *   3. Stores policy_number on the case
 *   4. Creates history events
 *   5. Optionally triggers preliminary DB entry
 *
 * Body:
 *   policy_number: string (required)
 *   notes?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const supabase = await getSupabaseServer();

    // Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { policy_number, notes } = body;

    if (!policy_number || typeof policy_number !== 'string' || policy_number.trim().length === 0) {
      return NextResponse.json({ error: 'policy_number es requerido' }, { status: 400 });
    }

    // Get current case
    const { data: currentCase } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (!currentCase) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
    }

    const previousStatus = currentCase.estado_simple;

    // Update case: set estado_simple to 'Enviado' and store policy_number
    const updatePayload: any = {
      estado_simple: 'Enviado',
      policy_number: policy_number.trim(),
    };

    if (notes) {
      updatePayload.notes = currentCase.notes
        ? `${currentCase.notes}\n[Emitido] ${notes}`
        : `[Emitido] ${notes}`;
    }

    const { data: updatedCase, error: updateError } = await supabase
      .from('cases')
      .update(updatePayload)
      .eq('id', caseId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // History event: emitido transition
    await supabase.from('case_history_events').insert({
      case_id: caseId,
      event_type: 'emitido_flow',
      payload: {
        previous_status: previousStatus,
        new_status: 'Enviado',
        policy_number: policy_number.trim(),
        notes: notes || null,
        triggered_by: user.id,
      },
      created_by_user_id: user.id,
      created_by_role: 'master',
      visible_to_broker: true,
    });

    // Audit log
    // @ts-ignore
    await supabase.from('security_audit_logs').insert({
      actor_user_id: user.id,
      actor_type: 'user',
      action: 'CASE_EMITIDO_FLOW',
      entity_type: 'case',
      entity_id: caseId,
      before: { estado_simple: previousStatus },
      after: { estado_simple: 'Enviado', policy_number: policy_number.trim() },
    });

    return NextResponse.json({
      success: true,
      case: updatedCase,
      policy_number: policy_number.trim(),
    });
  } catch (error: any) {
    console.error('[EMITIDO-FLOW]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
