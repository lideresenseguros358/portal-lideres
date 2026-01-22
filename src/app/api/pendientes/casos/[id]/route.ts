import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServer();
    const caseId = params.id;

    // Verificar autenticación
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener perfil
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isMaster = profile?.role === 'master';

    // Solo master puede editar casos
    if (!isMaster) {
      return NextResponse.json(
        { error: 'Only masters can edit cases' },
        { status: 403 }
      );
    }

    // Obtener updates del body
    const updates = await request.json();

    // Actualizar caso
    const { data: updatedCase, error } = await supabase
      .from('cases')
      .update(updates)
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Crear evento de historial
    await supabase.from('case_history_events').insert({
      case_id: caseId,
      event_type: 'case_updated',
      payload: updates,
      created_by_user_id: user.id,
      created_by_role: 'master',
      visible_to_broker: true,
    });

    // Audit log
    await supabase.from('security_audit_logs').insert({
      actor_user_id: user.id,
      actor_type: 'user',
      action: 'CASE_UPDATED',
      entity_type: 'case',
      entity_id: caseId,
      after: updates,
    });

    return NextResponse.json(updatedCase);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
