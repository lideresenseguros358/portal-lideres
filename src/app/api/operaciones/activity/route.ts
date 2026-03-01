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
        // Get DB session blocks for a user on a given date
        const { data: sessions, error: sessErr } = await supabase
          .from('ops_user_sessions')
          .select('*')
          .eq('user_id', user_id)
          .gte('session_start', `${date}T00:00:00`)
          .lte('session_start', `${date}T23:59:59`)
          .order('session_start', { ascending: true });

        if (sessErr) throw sessErr;

        let totalHours = 0;
        (sessions ?? []).forEach((s: any) => {
          totalHours += (s.duration_minutes || 0) / 60;
        });

        return NextResponse.json({
          success: true,
          blocks: sessions || [],
          totalHours: Math.round(totalHours * 100) / 100,
        });
      }

      case 'start_session_block': {
        const { user_id, block_id } = body;
        if (!user_id || !block_id) {
          return NextResponse.json({ error: 'Missing user_id or block_id' }, { status: 400 });
        }
        const { data: sessionId, error: startErr } = await supabase.rpc('ops_start_session_block', {
          p_user_id: user_id,
          p_block_id: block_id,
        });
        if (startErr) throw startErr;
        return NextResponse.json({ success: true, session_id: sessionId });
      }

      case 'close_session_block': {
        const { user_id, block_id } = body;
        if (!user_id || !block_id) {
          return NextResponse.json({ error: 'Missing user_id or block_id' }, { status: 400 });
        }
        const { data: closed, error: closeErr } = await supabase.rpc('ops_close_session_block', {
          p_user_id: user_id,
          p_block_id: block_id,
        });
        if (closeErr) throw closeErr;
        return NextResponse.json({ success: true, closed });
      }

      case 'mark_first_response': {
        const { case_id, user_id } = body;
        if (!case_id) {
          return NextResponse.json({ error: 'Missing case_id' }, { status: 400 });
        }
        const { data: marked, error: markErr } = await supabase.rpc('ops_mark_first_response', {
          p_case_id: case_id,
          p_user_id: user_id || null,
        });
        if (markErr) throw markErr;
        return NextResponse.json({ success: true, marked });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
