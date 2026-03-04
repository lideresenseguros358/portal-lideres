import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { emailService } from '@/lib/email/emailService';
import { buildPaymentLinkEmail, buildCaseNotificationEmail } from '@/lib/email/templates/OpsEmailTemplates';
import { logActivity } from '@/lib/operaciones/logActivity';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Email Threads & Messages API
// IMAP sync + Zepto send
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
        const { thread_id, to_email, subject, body_html, body_text, user_id } = body;

        if (!to_email || !subject) {
          return NextResponse.json({ error: 'to_email and subject required' }, { status: 400 });
        }

        // Send via Zepto
        const sendResult = await emailService.send({
          to: to_email,
          subject,
          html: body_html || `<p>${(body_text || '').replace(/\n/g, '<br/>')}</p>`,
          text: body_text,
        });

        // Save outbound message record
        const { data, error } = await supabase.from('ops_email_messages').insert({
          thread_id: thread_id || null,
          direction: 'OUTBOUND',
          from_email: process.env.ZEPTO_SENDER || 'portal@lideresenseguros.com',
          to_email,
          subject,
          body_html,
          body_text,
          metadata: {
            zepto_message_id: sendResult.messageId || null,
            zepto_success: sendResult.success,
            zepto_error: sendResult.error || null,
          },
        }).select().single();
        if (error) throw error;

        // Update thread last_message_at
        if (thread_id) {
          await supabase.from('ops_email_threads')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', thread_id);
        }

        // Log activity
        logActivity({
          userId: user_id || null,
          actionType: 'email_sent',
          entityType: 'email',
          entityId: data?.id || null,
          metadata: { to_email, subject: subject.substring(0, 100), sent: sendResult.success },
        });

        return NextResponse.json({
          success: sendResult.success,
          data,
          email_sent: sendResult.success,
          email_error: sendResult.error || null,
        });
      }

      case 'send_payment_link': {
        const {
          to_email, client_name, policy_number, insurer_name,
          ticket, case_type, payment_link, amount, concept,
          expires_at, sender_name, case_id, user_id,
        } = body;

        if (!to_email || !payment_link || !ticket) {
          return NextResponse.json({ error: 'to_email, payment_link, and ticket required' }, { status: 400 });
        }

        // Build email from template
        const email = buildPaymentLinkEmail({
          clientName: client_name || 'Cliente',
          policyNumber: policy_number,
          insurerName: insurer_name,
          ticket,
          caseType: case_type || 'renovacion',
          paymentLink: payment_link,
          amount,
          concept,
          expiresAt: expires_at,
          senderName: sender_name,
        });

        // Send via Zepto
        const sendResult = await emailService.send({
          to: to_email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });

        // Save outbound message record
        await supabase.from('ops_email_messages').insert({
          thread_id: null,
          direction: 'OUTBOUND',
          from_email: process.env.ZEPTO_SENDER || 'portal@lideresenseguros.com',
          to_email,
          subject: email.subject,
          body_html: email.html,
          body_text: email.text,
          metadata: {
            template: 'payment_link',
            payment_link,
            case_id: case_id || null,
            zepto_message_id: sendResult.messageId || null,
            zepto_success: sendResult.success,
          },
        });

        // Log activity
        logActivity({
          userId: user_id || null,
          actionType: 'email_sent',
          entityType: 'case',
          entityId: case_id || null,
          metadata: {
            template: 'payment_link',
            to_email,
            ticket,
            case_type,
            amount,
            sent: sendResult.success,
          },
        });

        return NextResponse.json({
          success: sendResult.success,
          email_sent: sendResult.success,
          email_error: sendResult.error || null,
          subject: email.subject,
        });
      }

      case 'send_case_notification': {
        const {
          to_email, client_name, ticket, case_type,
          policy_number, insurer_name, body_html, body_text,
          sender_name, case_id, user_id,
        } = body;

        if (!to_email || !ticket) {
          return NextResponse.json({ error: 'to_email and ticket required' }, { status: 400 });
        }

        const email = buildCaseNotificationEmail({
          clientName: client_name || 'Cliente',
          ticket,
          caseType: case_type || 'renovacion',
          policyNumber: policy_number,
          insurerName: insurer_name,
          bodyHtml: body_html || '',
          bodyText: body_text,
          senderName: sender_name,
        });

        const sendResult = await emailService.send({
          to: to_email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });

        await supabase.from('ops_email_messages').insert({
          thread_id: null,
          direction: 'OUTBOUND',
          from_email: process.env.ZEPTO_SENDER || 'portal@lideresenseguros.com',
          to_email,
          subject: email.subject,
          body_html: email.html,
          body_text: email.text,
          metadata: {
            template: 'case_notification',
            case_id: case_id || null,
            zepto_message_id: sendResult.messageId || null,
            zepto_success: sendResult.success,
          },
        });

        logActivity({
          userId: user_id || null,
          actionType: 'email_sent',
          entityType: 'case',
          entityId: case_id || null,
          metadata: { template: 'case_notification', to_email, ticket, sent: sendResult.success },
        });

        return NextResponse.json({
          success: sendResult.success,
          email_sent: sendResult.success,
          email_error: sendResult.error || null,
        });
      }

      case 'classify_thread': {
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
