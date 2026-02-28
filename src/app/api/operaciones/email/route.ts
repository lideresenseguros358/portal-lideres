import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Email Threads & Messages API
// IMAP sync + SMTP send stubs
// ═══════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('thread_id');
    const ticketId = searchParams.get('ticket_id');
    const ticketType = searchParams.get('ticket_type');
    const status = searchParams.get('status');

    // If threadId, return messages for that thread
    if (threadId) {
      const { data, error } = await supabase
        .from('ops_email_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return NextResponse.json({ data });
    }

    // Otherwise, return threads
    let query = supabase
      .from('ops_email_threads')
      .select('*', { count: 'exact' })
      .order('last_message_at', { ascending: false });

    if (ticketId) query = query.eq('ticket_id', ticketId);
    if (ticketType) query = query.eq('ticket_type', ticketType);
    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data, total: count });
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
      case 'send_email': {
        // TODO: Send email via SMTP from portal@lideresenseguros.com
        // For now, just save the outbound message record
        const { thread_id, to_email, subject, body_html, body_text } = body;

        const { data, error } = await supabase.from('ops_email_messages').insert({
          thread_id,
          direction: 'OUTBOUND',
          from_email: 'portal@lideresenseguros.com',
          to_email,
          subject,
          body_html,
          body_text,
        }).select().single();
        if (error) throw error;

        // Update thread last_message_at
        await supabase.from('ops_email_threads')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', thread_id);

        return NextResponse.json({ success: true, data });
      }

      case 'classify_thread': {
        // Assign an unclassified thread to a ticket
        const { thread_id, ticket_id, ticket_type } = body;
        const { error } = await supabase.from('ops_email_threads').update({
          ticket_id,
          ticket_type,
          status: 'ABIERTO',
        }).eq('id', thread_id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'discard_thread': {
        const { thread_id } = body;
        const { error } = await supabase.from('ops_email_threads').update({
          status: 'CERRADO',
        }).eq('id', thread_id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
