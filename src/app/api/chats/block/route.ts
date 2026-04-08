/**
 * API Endpoint: Block/Unblock Chat Thread
 * POST /api/chats/block
 *
 * Request:
 *   { thread_id: string, is_blocked: boolean }
 *
 * Response:
 *   { success: boolean, message: string }
 *
 * When blocked:
 *   - AI cannot send messages to this phone number
 *   - Thread moves to "Bloqueados" filter
 *   - Manual masters can still view/manage the thread
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { thread_id, is_blocked } = await request.json();

    if (!thread_id || typeof is_blocked !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'Missing or invalid thread_id or is_blocked' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServer();

    // Update thread blocked status
    const { error } = await supabase
      .from('chat_threads')
      .update({ is_blocked } as any)
      .eq('id', thread_id);

    if (error) {
      console.error('[API Chats Block] Supabase error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to update thread' },
        { status: 500 }
      );
    }

    // Log the action
    const eventType = is_blocked ? 'blocked' : 'unblocked';
    await supabase
      .from('chat_events')
      .insert({
        thread_id,
        event_type: eventType,
        payload: { action: is_blocked ? 'block' : 'unblock' },
      });

    const action = is_blocked ? 'Número bloqueado' : 'Número desbloqueado';
    return NextResponse.json({
      success: true,
      message: action,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API Chats Block] Error:', msg);
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}
