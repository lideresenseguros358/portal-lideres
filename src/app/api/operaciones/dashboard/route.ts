/**
 * GET /api/operaciones/dashboard
 * Returns all counters and summary data for the Operaciones Resumen tab.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const CLOSED = ['cerrado_renovado', 'cerrado_cancelado', 'cerrado', 'perdido', 'resuelto'];

export async function GET() {
  try {
    const supabase = getSupabaseAdmin() as any;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    const rangeStart = `${today}T00:00:00`;
    const rangeEnd = `${today}T23:59:59`;

    // ── All queries in parallel ──
    const [
      renPendiente,
      petPendiente,
      urgPendiente,
      morosidadCount,
      mastersCount,
      slaBreachedCount,
      closedTodayCount,
      sessionsToday,
      renProximas,
      urgRecientes,
      activityForTimeline,
      allActivityToday,
    ] = await Promise.all([
      // 1. Renovaciones pendientes (not closed)
      supabase
        .from('ops_cases')
        .select('id', { count: 'exact', head: true })
        .eq('case_type', 'renovacion')
        .not('status', 'in', `(${CLOSED.join(',')})`),

      // 2. Peticiones abiertas (not closed)
      supabase
        .from('ops_cases')
        .select('id', { count: 'exact', head: true })
        .eq('case_type', 'peticion')
        .not('status', 'in', `(${CLOSED.join(',')})`),

      // 3. Urgencias activas (not closed)
      supabase
        .from('ops_cases')
        .select('id', { count: 'exact', head: true })
        .eq('case_type', 'urgencia')
        .not('status', 'in', `(${CLOSED.join(',')})`),

      // 4. Morosidad
      supabase
        .from('ops_morosidad_view')
        .select('policy_id', { count: 'exact', head: true })
        .eq('morosidad_status', 'atrasado'),

      // 5. Masters activos
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'master'),

      // 6. SLA vencidos (active cases with sla_breached)
      supabase
        .from('ops_cases')
        .select('id', { count: 'exact', head: true })
        .eq('sla_breached', true)
        .not('status', 'in', `(${CLOSED.join(',')})`),

      // 7. Cerrados hoy
      supabase
        .from('ops_cases')
        .select('id', { count: 'exact', head: true })
        .in('status', CLOSED)
        .gte('closed_at', rangeStart)
        .lte('closed_at', rangeEnd),

      // 8. Sessions hoy (horas equipo)
      supabase
        .from('ops_user_sessions')
        .select('duration_minutes')
        .gte('session_start', rangeStart)
        .lte('session_start', rangeEnd),

      // 9. Renovaciones próximas (top 8, ordered by renewal_date)
      supabase
        .from('ops_cases')
        .select('id, ticket, client_name, insurer_name, policy_number, renewal_date, status, assigned_master_id')
        .eq('case_type', 'renovacion')
        .not('status', 'in', `(${CLOSED.join(',')})`)
        .order('renewal_date', { ascending: true })
        .limit(8),

      // 10. Urgencias recientes (top 6)
      supabase
        .from('ops_cases')
        .select('id, ticket, client_name, insurer_name, status, created_at, sla_breached')
        .eq('case_type', 'urgencia')
        .not('status', 'in', `(${CLOSED.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(6),

      // 11. Activity today — limited for UI timeline
      supabase
        .from('ops_activity_log')
        .select('id, user_id, action_type, entity_type, created_at, metadata')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd)
        .order('created_at', { ascending: false })
        .limit(15),

      // 12. ALL activity today — unlimited, for hours estimation
      supabase
        .from('ops_activity_log')
        .select('user_id, created_at')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd)
        .order('created_at', { ascending: true }),
    ]);

    // Compute hours today — use ops_user_sessions if available,
    // otherwise estimate from ops_activity_log timestamps (same logic as team API)
    const sessionMinutes = (sessionsToday.data || []).reduce(
      (s: number, r: any) => s + (r.duration_minutes || 0), 0
    );

    // Estimate hours from activity log timestamps grouped by user (using ALL logs, not limited)
    let activityEstimatedMinutes = 0;
    const activityRows = allActivityToday.data || [];
    if (activityRows.length > 0) {
      const byUser = new Map<string, string[]>();
      for (const a of activityRows as any[]) {
        if (!a.user_id || !a.created_at) continue;
        if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
        byUser.get(a.user_id)!.push(a.created_at);
      }
      for (const [, timestamps] of byUser) {
        timestamps.sort();
        if (timestamps.length === 1) {
          activityEstimatedMinutes += 15; // single action = 15 min
        } else {
          let userMins = 0;
          for (let i = 1; i < timestamps.length; i++) {
            const gap = (new Date(timestamps[i]!).getTime() - new Date(timestamps[i - 1]!).getTime()) / 60000;
            userMins += Math.min(gap, 30); // Cap gaps at 30 min (idle cutoff)
          }
          activityEstimatedMinutes += Math.max(userMins, 15); // Min 15 min per active user
        }
      }
    }

    // Use whichever is greater: session tracking or activity-based estimation
    const hoursTeamToday = Math.round((Math.max(sessionMinutes, activityEstimatedMinutes) / 60) * 10) / 10;

    // Resolve master names for activity (use all logs for complete user coverage)
    const masterIds = [...new Set((allActivityToday.data || []).map((a: any) => a.user_id).filter(Boolean))];
    let masterNameMap: Record<string, string> = {};
    if (masterIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', masterIds);
      for (const p of (profiles || [])) {
        masterNameMap[p.id] = p.full_name || 'Usuario';
      }
    }

    const activity = (activityForTimeline.data || []).map((a: any) => ({
      ...a,
      user_name: masterNameMap[a.user_id] || null,
    }));

    return NextResponse.json({
      counters: {
        renovaciones_pendientes: renPendiente.count || 0,
        peticiones_abiertas: petPendiente.count || 0,
        urgencias_activas: urgPendiente.count || 0,
        morosidad: morosidadCount.count || 0,
        equipo_activo: mastersCount.count || 0,
        sla_vencidos: slaBreachedCount.count || 0,
        cerrados_hoy: closedTodayCount.count || 0,
        horas_equipo_hoy: hoursTeamToday,
      },
      renovaciones_proximas: renProximas.data || [],
      urgencias_recientes: urgRecientes.data || [],
      actividad_hoy: activity,
    });
  } catch (err: any) {
    console.error('[Dashboard API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
