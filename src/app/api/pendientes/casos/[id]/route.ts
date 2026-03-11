import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { 
  notifyCaseUpdated,
  notifyCaseClosedApproved,
  notifyCaseClosedRejected,
  notifyCasePostponed
} from '@/lib/email/pendientes';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const supabase = await getSupabaseServer();

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
      .select('role, full_name')
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

    // Obtener caso actual para comparar cambios
    const { data: currentCase } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

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
    // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
    await supabase.from('case_history_events').insert({
      case_id: caseId,
      event_type: 'case_updated',
      payload: updates,
      created_by_user_id: user.id,
      created_by_role: 'master',
      visible_to_broker: true,
    });

    // Audit log
    // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
    await supabase.from('security_audit_logs').insert({
      actor_user_id: user.id,
      actor_type: 'user',
      action: 'CASE_UPDATED',
      entity_type: 'case',
      entity_id: caseId,
      after: updates,
    });

    // Enviar correos de notificación según el tipo de cambio
    try {
      const prevStatus = currentCase?.estado_simple;
      const newStatus = updatedCase.estado_simple;
      const statusChanged = prevStatus !== newStatus;

      if (statusChanged && newStatus === 'Cerrado aprobado') {
        await notifyCaseClosedApproved(caseId, {
          closedBy: profile?.full_name || 'Administrador',
          closedAt: new Date().toISOString(),
          notes: updates.closing_notes || updates.notes,
        });
        console.log(`[CASES PATCH] ✅ Email cierre aprobado enviado para caso ${caseId}`);
      } else if (statusChanged && newStatus === 'Cerrado rechazado') {
        await notifyCaseClosedRejected(caseId, {
          closedBy: profile?.full_name || 'Administrador',
          closedAt: new Date().toISOString(),
          reason: updates.closing_reason || 'Rechazado por administración',
          notes: updates.closing_notes || updates.notes,
        });
        console.log(`[CASES PATCH] ✅ Email cierre rechazado enviado para caso ${caseId}`);
      } else if (statusChanged && newStatus === 'Aplazado') {
        await notifyCasePostponed(caseId, {
          aplazadoBy: profile?.full_name || 'Administrador',
          reason: updates.aplazar_reason,
        });
        console.log(`[CASES PATCH] ✅ Email aplazamiento enviado para caso ${caseId}`);
      } else if (statusChanged) {
        // Cualquier otro cambio de estado → notificar actualización
        const changes = Object.keys(updates).map(key => ({
          field: key,
          oldValue: (currentCase as any)?.[key],
          newValue: updates[key],
        }));
        await notifyCaseUpdated(caseId, changes);
        console.log(`[CASES PATCH] ✅ Email actualización enviado para caso ${caseId}`);
      }
    } catch (emailError) {
      console.error('[CASES PATCH] ⚠️ Error enviando correo de notificación:', emailError);
      // No fallar la respuesta si el correo falla
    }

    return NextResponse.json(updatedCase);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
