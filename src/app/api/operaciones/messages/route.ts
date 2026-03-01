/**
 * API — /api/operaciones/messages
 * =================================
 * GET  ?case_id=xxx         → messages for a case (paginated)
 * GET  ?unclassified=true   → unclassified messages (paginated)
 * POST { action, message_id, case_id? } → assign or discard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// ── GET ──
export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const url = request.nextUrl;

  const caseId = url.searchParams.get('case_id');
  const unclassified = url.searchParams.get('unclassified');
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  try {
    if (caseId) {
      // Messages for a specific case
      const { data, error, count } = await (supabase as any)
        .from('ops_case_messages')
        .select('*', { count: 'exact' })
        .eq('case_id', caseId)
        .order('received_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return NextResponse.json({
        messages: data || [],
        total: count || 0,
        page,
        limit,
      });
    }

    if (unclassified === 'true') {
      // Unclassified messages (not discarded)
      const { data, error, count } = await (supabase as any)
        .from('ops_case_messages')
        .select('*', { count: 'exact' })
        .eq('unclassified', true)
        .order('received_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Filter out discarded in application layer
      const filtered = (data || []).filter(
        (m: any) => !m.metadata?.discarded,
      );

      return NextResponse.json({
        messages: filtered,
        total: count || 0,
        page,
        limit,
      });
    }

    return NextResponse.json(
      { error: 'Provide case_id or unclassified=true' },
      { status: 400 },
    );
  } catch (err: any) {
    console.error('[API messages GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST ──
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { action, message_id, case_id, user_id } = body as {
      action: 'assign' | 'discard';
      message_id: string;
      case_id?: string;
      user_id?: string;
    };

    if (!action || !message_id) {
      return NextResponse.json(
        { error: 'action and message_id required' },
        { status: 400 },
      );
    }

    // Fetch the message
    const { data: msg, error: fetchErr } = await (supabase as any)
      .from('ops_case_messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (fetchErr || !msg) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (action === 'assign') {
      if (!case_id) {
        return NextResponse.json(
          { error: 'case_id required for assign action' },
          { status: 400 },
        );
      }

      // Verify case exists
      const { data: caseRow } = await (supabase as any)
        .from('ops_cases')
        .select('id, ticket')
        .eq('id', case_id)
        .single();

      if (!caseRow) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }

      // Update message
      const { error: upErr } = await (supabase as any)
        .from('ops_case_messages')
        .update({
          case_id,
          unclassified: false,
          metadata: {
            ...msg.metadata,
            manually_assigned: true,
            assigned_at: new Date().toISOString(),
            assigned_by: user_id || null,
            assigned_to_ticket: caseRow.ticket,
          },
        })
        .eq('id', message_id);

      if (upErr) throw upErr;

      // Log activity
      await (supabase as any).from('ops_activity_log').insert({
        user_id: user_id || null,
        action_type: 'imap_manual_assign',
        entity_type: 'email',
        entity_id: case_id,
        metadata: {
          message_id: msg.id,
          from_email: msg.from_email,
          subject: (msg.subject || '').substring(0, 200),
          assigned_to_ticket: caseRow.ticket,
        },
      });

      return NextResponse.json({ success: true, action: 'assigned', case_id, ticket: caseRow.ticket });
    }

    if (action === 'discard') {
      const { error: upErr } = await (supabase as any)
        .from('ops_case_messages')
        .update({
          metadata: {
            ...msg.metadata,
            discarded: true,
            discarded_at: new Date().toISOString(),
            discarded_by: user_id || null,
          },
        })
        .eq('id', message_id);

      if (upErr) throw upErr;

      // Log activity
      await (supabase as any).from('ops_activity_log').insert({
        user_id: user_id || null,
        action_type: 'imap_manual_discard',
        entity_type: 'email',
        entity_id: null,
        metadata: {
          message_id: msg.id,
          from_email: msg.from_email,
          subject: (msg.subject || '').substring(0, 200),
        },
      });

      return NextResponse.json({ success: true, action: 'discarded' });
    }

    if (action === 'record_outbound') {
      // Record an outbound email sent from the UI and mark first_response_at if needed
      const { case_id: outCaseId, subject, body_html, body_text, from_email, to_emails, message_id_header } = body as any;
      if (!outCaseId) {
        return NextResponse.json({ error: 'case_id required for record_outbound' }, { status: 400 });
      }

      // Insert outbound message record
      const { error: insErr } = await (supabase as any)
        .from('ops_case_messages')
        .insert({
          case_id: outCaseId,
          unclassified: false,
          direction: 'outbound',
          provider: 'zepto',
          message_id: message_id_header || `outbound-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          from_email: from_email || 'portal@lideresenseguros.com',
          to_emails: to_emails || [],
          subject: subject || '',
          body_text: body_text || null,
          body_html: body_html || null,
          received_at: new Date().toISOString(),
          metadata: { sent_by: user_id || null },
        });

      if (insErr) throw insErr;

      // Mark first_response_at if null
      const { data: caseRow } = await (supabase as any)
        .from('ops_cases')
        .select('first_response_at')
        .eq('id', outCaseId)
        .single();

      if (caseRow && !caseRow.first_response_at) {
        await (supabase as any)
          .from('ops_cases')
          .update({ first_response_at: new Date().toISOString() })
          .eq('id', outCaseId);

        // Log first response
        await (supabase as any).from('ops_activity_log').insert({
          user_id: user_id || null,
          action_type: 'first_response',
          entity_type: 'case',
          entity_id: outCaseId,
          metadata: { triggered_by: 'outbound_email' },
        });

        console.log(`[API messages] first_response_at marked for case ${outCaseId}`);
      }

      return NextResponse.json({ success: true, action: 'outbound_recorded' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API messages POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
