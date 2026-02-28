import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Activity Log API
// Auto-registro de jornada (no button required)
// ═══════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const date = searchParams.get('date');
    const sessionBlockId = searchParams.get('session_block_id');

    let query = supabase
      .from('ops_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (userId) query = query.eq('user_id', userId);
    if (date) {
      query = query.gte('created_at', `${date}T00:00:00`)
                    .lte('created_at', `${date}T23:59:59`);
    }
    if (sessionBlockId) query = query.eq('session_block_id', sessionBlockId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'log_activity': {
        const { user_id, action_type, entity_type, entity_id, metadata, session_block_id } = body;
        const { data, error } = await supabase.from('ops_activity_log').insert({
          user_id,
          action_type,
          entity_type,
          entity_id,
          metadata,
          session_block_id,
        }).select().single();
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }

      case 'get_session_summary': {
        const { user_id, date } = body;
        // Get all session blocks for a user on a given date
        const { data, error } = await supabase
          .from('ops_activity_log')
          .select('session_block_id, action_type, created_at')
          .eq('user_id', user_id)
          .gte('created_at', `${date}T00:00:00`)
          .lte('created_at', `${date}T23:59:59`)
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Group by session blocks, compute hours per block
        const blocks: Record<string, { start: string; end: string; productive_actions: number }> = {};
        data?.forEach((row: any) => {
          const bid = row.session_block_id || 'unknown';
          if (!blocks[bid]) {
            blocks[bid] = { start: row.created_at, end: row.created_at, productive_actions: 0 };
          }
          blocks[bid].end = row.created_at;
          if (row.action_type !== 'navigation' && row.action_type !== 'session_start' && row.action_type !== 'session_end') {
            blocks[bid].productive_actions++;
          }
        });

        let totalHours = 0;
        Object.values(blocks).forEach(b => {
          const diff = (new Date(b.end).getTime() - new Date(b.start).getTime()) / (1000 * 60 * 60);
          totalHours += diff;
        });

        return NextResponse.json({
          success: true,
          blocks: Object.entries(blocks).map(([id, b]) => ({ id, ...b })),
          totalHours: Math.round(totalHours * 100) / 100,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
