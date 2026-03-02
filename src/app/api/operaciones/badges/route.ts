/**
 * GET /api/operaciones/badges
 * Returns badge counts for each Operaciones module tab.
 * Lightweight endpoint polled by OperacionesShell.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // ── Renovaciones: pendiente cases + unclassified messages ──
    const [renCases, renUnclassified] = await Promise.all([
      supabase
        .from('ops_cases')
        .select('id', { count: 'exact', head: true })
        .eq('case_type', 'renovacion')
        .eq('status', 'pendiente'),
      supabase
        .from('ops_case_messages')
        .select('id', { count: 'exact', head: true })
        .eq('unclassified', true),
    ]);
    const renovaciones = (renCases.count || 0) + (renUnclassified.count || 0);

    // ── Peticiones: pendiente cases ──
    const { count: petCount } = await supabase
      .from('ops_cases')
      .select('id', { count: 'exact', head: true })
      .eq('case_type', 'peticion')
      .eq('status', 'pendiente');
    const peticiones = petCount || 0;

    // ── Urgencias: pendiente cases ──
    const { count: urgCount } = await supabase
      .from('ops_cases')
      .select('id', { count: 'exact', head: true })
      .eq('case_type', 'urgencia')
      .eq('status', 'pendiente');
    const urgencias = urgCount || 0;

    // ── Morosidad: atrasado rows ──
    const { count: morCount } = await supabase
      .from('ops_morosidad_view')
      .select('policy_id', { count: 'exact', head: true })
      .eq('morosidad_status', 'atrasado');
    const morosidad = morCount || 0;

    return NextResponse.json({
      renovaciones,
      peticiones,
      urgencias,
      morosidad,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
