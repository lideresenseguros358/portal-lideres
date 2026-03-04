/**
 * API — /api/operaciones/messages
 * =================================
 * GET  ?case_id=xxx         → messages for a case (paginated)
 * GET  ?unclassified=true   → unclassified messages (paginated)
 * POST { action, message_id, case_id? } → assign or discard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendZeptoEmail, type ZeptoAttachment } from '@/lib/email/zepto-api';
import { wrapInBrandedTemplate } from '@/lib/email/templates/OpsEmailTemplates';

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

// ── Helper: parse body as JSON or FormData ──
async function parseBody(request: NextRequest): Promise<{ fields: Record<string, any>; files: File[] }> {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const fd = await request.formData();
    const fields: Record<string, any> = {};
    const files: File[] = [];
    fd.forEach((value, key) => {
      if (value instanceof File) {
        files.push(value);
      } else {
        // Try parse JSON strings
        try { fields[key] = JSON.parse(value as string); } catch { fields[key] = value; }
      }
    });
    return { fields, files };
  }
  // Default: JSON body
  const json = await request.json();
  return { fields: json, files: [] };
}

// ── POST ──
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const { fields: body, files } = await parseBody(request);
    const { action, message_id, case_id, user_id } = body as {
      action: 'assign' | 'discard' | 'record_outbound';
      message_id: string;
      case_id?: string;
      user_id?: string;
    };

    // Handle record_outbound first (doesn't require message_id)
    if (action === 'record_outbound') {
      const { case_id: outCaseId, subject, body_html, body_text, from_email, to_emails, message_id_header, master_name, master_email } = body as any;
      if (!outCaseId) {
        return NextResponse.json({ error: 'case_id required for record_outbound' }, { status: 400 });
      }

      const recipientList: string[] = to_emails || [];
      const senderAddr = from_email || 'portal@lideresenseguros.com';
      let zeptoMessageId: string | undefined;
      let sendError: string | undefined;

      // ── Convert file attachments to base64 for Zepto ──
      const zeptoAttachments: ZeptoAttachment[] = [];
      for (const file of files) {
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          zeptoAttachments.push({
            content: buffer.toString('base64'),
            mime_type: file.type || 'application/octet-stream',
            name: file.name,
          });
        } catch (err) {
          console.error(`[API messages] Failed to read attachment ${file.name}:`, err);
        }
      }
      if (zeptoAttachments.length > 0) {
        console.log(`[API messages] ${zeptoAttachments.length} attachment(s): ${zeptoAttachments.map(a => a.name).join(', ')}`);
      }

      // ── Resolve assigned master from case if not provided by frontend ──
      let resolvedMasterName = master_name || null;
      let resolvedMasterEmail = master_email || null;
      if (!resolvedMasterName && !resolvedMasterEmail) {
        try {
          const { data: caseRow } = await (supabase as any)
            .from('ops_cases')
            .select('assigned_master_id')
            .eq('id', outCaseId)
            .single();
          if (caseRow?.assigned_master_id) {
            const { data: profile } = await (supabase as any)
              .from('profiles')
              .select('full_name, email')
              .eq('id', caseRow.assigned_master_id)
              .single();
            if (profile) {
              resolvedMasterName = profile.full_name || null;
              resolvedMasterEmail = profile.email || null;
            }
          }
        } catch { /* non-fatal */ }
      }

      // ── Build master signature block ──
      let signatureHtml = '';
      if (resolvedMasterName || resolvedMasterEmail) {
        signatureHtml = `
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;font-family:Arial,sans-serif;">
  <p style="margin:0 0 4px;"><strong style="color:#010139;">${resolvedMasterName || 'Equipo Líderes en Seguros'}</strong></p>
  ${resolvedMasterEmail ? `<p style="margin:0 0 4px;"><a href="mailto:${resolvedMasterEmail}" style="color:#010139;text-decoration:none;">${resolvedMasterEmail}</a></p>` : ''}
  <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">Líderes en Seguros, S.A. | portal.lideresenseguros.com</p>
</div>`;
      }

      // ── Actually send the email via ZeptoMail ──
      if (recipientList.length > 0 && recipientList[0]) {
        // Build body content from text or html
        const bodyContent = body_html
          || `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;white-space:pre-wrap;">${(body_text || '').replace(/\n/g, '<br/>')}</div>`;
        // Wrap in branded template (logo + footer + regulatory cintillo)
        const html = wrapInBrandedTemplate(bodyContent + signatureHtml);

        for (const recipientEmail of recipientList) {
          const result = await sendZeptoEmail({
            to: recipientEmail,
            subject: subject || '(sin asunto)',
            htmlBody: html,
            textBody: body_text || undefined,
            replyTo: senderAddr,
            attachments: zeptoAttachments.length > 0 ? zeptoAttachments : undefined,
          });

          if (result.success) {
            zeptoMessageId = result.messageId;
            console.log(`[API messages] ✓ Email sent to ${recipientEmail} via Zepto (msgId: ${result.messageId})`);
          } else {
            sendError = result.error;
            console.error(`[API messages] ✗ Zepto send failed for ${recipientEmail}:`, result.error);
          }
        }
      } else {
        console.warn(`[API messages] No recipient email — message recorded but NOT sent`);
      }

      // Insert outbound message record
      const attachmentNames = zeptoAttachments.map(a => a.name);
      const { error: insErr } = await (supabase as any)
        .from('ops_case_messages')
        .insert({
          case_id: outCaseId,
          unclassified: false,
          direction: 'outbound',
          provider: 'zepto',
          message_id: zeptoMessageId || message_id_header || `outbound-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          from_email: senderAddr,
          to_emails: recipientList,
          subject: subject || '',
          body_text: body_text || null,
          body_html: body_html || null,
          received_at: new Date().toISOString(),
          metadata: {
            sent_by: user_id || null,
            zepto_message_id: zeptoMessageId || null,
            send_error: sendError || null,
            has_attachments: attachmentNames.length > 0,
            attachment_names: attachmentNames.length > 0 ? attachmentNames : undefined,
          },
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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API messages POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
