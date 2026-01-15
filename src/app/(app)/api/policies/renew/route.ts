import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/db/context';

export async function POST(request: Request) {
  try {
    const { role } = await getAuthContext();
    
    if (!role) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }

    const { policyId } = await request.json();

    if (!policyId) {
      return NextResponse.json({ ok: false, error: 'ID de póliza requerido' }, { status: 400 });
    }

    const supabase = await getSupabaseServer();

    // Obtener la póliza actual
    const { data: policy, error: policyError } = await supabase
      .from('policies')
      .select('id, policy_number, start_date, renewal_date, client_id, status')
      .eq('id', policyId)
      .single();

    if (policyError || !policy) {
      return NextResponse.json({ ok: false, error: 'Póliza no encontrada' }, { status: 404 });
    }

    // Validar que exista renewal_date
    if (!policy.renewal_date) {
      return NextResponse.json({ ok: false, error: 'Póliza sin fecha de renovación' }, { status: 400 });
    }

    // Calcular nuevas fechas (sumar 1 año)
    const currentStart = new Date(policy.start_date || policy.renewal_date);
    const currentRenewal = new Date(policy.renewal_date);

    const newStart = new Date(currentStart);
    newStart.setFullYear(currentStart.getFullYear() + 1);

    const newRenewal = new Date(currentRenewal);
    newRenewal.setFullYear(currentRenewal.getFullYear() + 1);

    // Actualizar la póliza
    const { error: updateError } = await supabase
      .from('policies')
      .update({
        start_date: newStart.toISOString().split('T')[0],
        renewal_date: newRenewal.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', policyId);

    if (updateError) {
      console.error('Error actualizando póliza:', updateError);
      return NextResponse.json({ ok: false, error: 'Error al renovar póliza' }, { status: 500 });
    }

    // Registrar en audit_logs
    await supabase.from('audit_logs').insert({
      action: 'POLICY_RENEWED',
      entity: 'policies',
      entity_id: policyId,
      meta: {
        policy_number: policy.policy_number,
        old_start_date: policy.start_date,
        new_start_date: newStart.toISOString().split('T')[0],
        old_renewal_date: policy.renewal_date,
        new_renewal_date: newRenewal.toISOString().split('T')[0],
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        newStartDate: newStart.toISOString().split('T')[0],
        newRenewalDate: newRenewal.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    console.error('Error en renovación de póliza:', error);
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
