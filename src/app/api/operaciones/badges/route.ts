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
    // ── Renovaciones: pendiente cases + unclassified messages (matching UI filters) ──
    const TICKET_RE = /(?:PET|REN|URG|MOR)-\d{4}-\d{5}/i;
    const [renCases, renUnclassifiedRaw] = await Promise.all([
      supabase
        .from('ops_cases')
        .select('id', { count: 'exact', head: true })
        .eq('case_type', 'renovacion')
        .eq('status', 'pendiente'),
      supabase
        .from('ops_case_messages')
        .select('id, subject, metadata')
        .eq('unclassified', true),
    ]);
    // Apply same filters as UnclassifiedMessages UI: exclude discarded, only portal/ticket subjects
    const visibleUnclassified = (renUnclassifiedRaw.data || []).filter((m: any) => {
      if (m.metadata?.discarded) return false;
      const subj = (m.subject || '').toLowerCase();
      return subj.includes('expediente portal') || TICKET_RE.test(m.subject || '');
    });
    const renovaciones = (renCases.count || 0) + visibleUnclassified.length;

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

    // ── Morosidad: atrasado rows from ops_morosidad_view only ──
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
