import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Team Metrics API
// ═══════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const periodType = searchParams.get('period_type') || 'day';
    const periodStart = searchParams.get('period_start');

    let query = supabase
      .from('ops_team_metrics')
      .select('*')
      .eq('period_type', periodType)
      .order('period_start', { ascending: false });

    if (userId) query = query.eq('user_id', userId);
    if (periodStart) query = query.gte('period_start', periodStart);

    const { data, error } = await query;
    if (error) throw error;

    // Get master users for cards
    const { data: masters } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('role', 'master');

    return NextResponse.json({ data, masters: masters || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
