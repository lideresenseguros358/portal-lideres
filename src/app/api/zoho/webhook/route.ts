// =====================================================
// ZOHO MAIL WEBHOOK - SKELETON
// =====================================================
// This is a skeleton/template for Zoho Mail webhook integration.
// Complete this when Zoho Mail API credentials are available.
//
// SETUP REQUIRED:
// 1. Configure webhook in Zoho Mail admin panel
// 2. Set webhook URL: https://your-domain.com/api/zoho/webhook
// 3. Add ZOHO_WEBHOOK_SECRET to .env.local
// 4. Uncomment and complete the implementation below
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { classifyEmail, guessClientName } from '@/lib/cases/classifier';
import { calculateSlaDate } from '@/lib/cases/sla';
import { actionCreateCase } from '@/app/(app)/cases/actions';

// Types for Zoho webhook payload
interface ZohoAttachment {
  name: string;
  mime_type: string;
  size: number;
  content?: string; // base64
  url?: string;
}

interface ZohoWebhookPayload {
  message_id: string;
  thread_id: string;
  from: string;
  from_name?: string;
  to: string[];
  cc?: string[];
  subject: string;
  text_body: string;
  html_body?: string;
  date: string;
  attachments?: ZohoAttachment[];
  headers?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Verify webhook secret
    // const webhookSecret = request.headers.get('x-zoho-webhook-secret');
    // if (webhookSecret !== process.env.ZOHO_WEBHOOK_SECRET) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const payload: ZohoWebhookPayload = await request.json();

    // Validate required fields
    if (!payload.message_id || !payload.from || !payload.subject) {
      return NextResponse.json(
        { ok: false, error: 'Invalid payload' },
        { status: 400 }
      );
    }

    // 1. Classify email using deterministic classifier
    const classification = classifyEmail(payload.subject, payload.text_body);
    
    // 2. Verify sender (broker or assistant)
    const senderVerification = await verifySender(payload.from);

    if (!senderVerification.verified) {
      // Email from unknown sender -> create in NO_IDENTIFICADOS
      return await createUnidentifiedCase(payload);
    }

    // 3. Check for existing case (by ticket_ref or thread_id within 48h)
    const existingCase = await findExistingCase(
      payload.message_id,
      payload.thread_id,
      classification.ticket_ref
    );

    if (existingCase) {
      // Update existing case
      return await updateExistingCase(existingCase.id, payload, classification);
    }

    // 4. Create new case
    const clientName = guessClientName(payload.subject, payload.text_body);

    // Get insurer_id if detected
    let insurerId: string | null = null;
    if (classification.insurer_name) {
      insurerId = await getInsurerId(classification.insurer_name);
    }

    // Calculate SLA
    const slaDefaults: Record<string, number> = {
      COTIZACION: 7,
      EMISION_GENERAL: 15,
      EMISION_VIDA_ASSA_WEB: 10,
      REHABILITACION: 10,
      MODIFICACION: 8,
      CANCELACION: 10,
      CAMBIO_CORREDOR: 5,
      RECLAMO: 20,
    };
    
    const slaDays = slaDefaults[classification.case_type || 'COTIZACION'] || 7;

    // Use actionCreateCase to create the case
    const result = await actionCreateCase({
      section: classification.section,
      ctype: classification.case_type || 'COTIZACION',
      canal: 'EMAIL',
      management_type: classification.case_type || 'COTIZACION',
      insurer_id: insurerId || '',
      broker_id: senderVerification.broker_id!,
      client_name: clientName || undefined,
      sla_days: slaDays,
      notes: `Email de: ${payload.from}\nAsunto: ${payload.subject}`,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    // TODO: Handle attachments
    // if (payload.attachments && payload.attachments.length > 0) {
    //   await handleAttachments(result.data.id, payload.attachments);
    // }

    return NextResponse.json({
      ok: true,
      case_id: result.data?.id,
      section: classification.section,
      confidence: classification.confidence,
    });

  } catch (error: any) {
    console.error('Zoho webhook error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function verifySender(email: string): Promise<{
  verified: boolean;
  broker_id?: string;
  type?: 'broker' | 'assistant';
}> {
  const supabase = getSupabaseAdmin();

  // Check if broker
  const { data: broker } = await supabase
    .from('brokers')
    .select('p_id')
    .eq('email', email)
    .eq('active', true)
    .single();

  if (broker) {
    return { verified: true, broker_id: broker.p_id, type: 'broker' };
  }

  // Check if assistant
  const { data: assistant } = await supabase
    .from('broker_assistants')
    .select('broker_id')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  if (assistant) {
    // Get broker's profile ID
    const { data: brokerData } = await supabase
      .from('brokers')
      .select('p_id')
      .eq('id', assistant.broker_id)
      .single();

    if (brokerData) {
      return { verified: true, broker_id: brokerData.p_id, type: 'assistant' };
    }
  }

  return { verified: false };
}

async function findExistingCase(
  messageId: string,
  threadId: string,
  ticketRef: string | null
): Promise<{ id: string } | null> {
  const supabase = getSupabaseAdmin();

  // Check by message_id (idempotency)
  const { data: byMessageId } = await supabase
    .from('cases')
    .select('id')
    .eq('message_id', messageId)
    .single();

  if (byMessageId) return byMessageId;

  // Check by ticket_ref
  if (ticketRef) {
    const { data: byTicket } = await supabase
      .from('cases')
      .select('id')
      .eq('ticket_ref', ticketRef)
      .single();

    if (byTicket) return byTicket;
  }

  // Check by thread_id (within 48h)
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const { data: byThread } = await supabase
    .from('cases')
    .select('id')
    .eq('thread_id', threadId)
    .gte('created_at', fortyEightHoursAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return byThread || null;
}

async function getInsurerId(insurerName: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  
  const { data } = await supabase
    .from('insurers')
    .select('id')
    .ilike('name', `%${insurerName}%`)
    .single();

  return data?.id || null;
}

async function createUnidentifiedCase(payload: ZohoWebhookPayload) {
  // TODO: Create case in NO_IDENTIFICADOS section
  return NextResponse.json({
    ok: true,
    message: 'Case created in NO_IDENTIFICADOS',
    requires_manual_assignment: true,
  });
}

async function updateExistingCase(
  caseId: string,
  payload: ZohoWebhookPayload,
  classification: any
) {
  const supabase = getSupabaseAdmin();

  // Update case with ticket if found
  const updates: any = {
    updated_at: new Date().toISOString(),
  };

  if (classification.ticket_ref) {
    updates.ticket_ref = classification.ticket_ref;
  }

  await supabase
    .from('cases')
    .update(updates)
    .eq('id', caseId);

  // Add history
  await supabase.from('case_history').insert([{
    case_id: caseId,
    action: 'EMAIL_UPDATE',
    metadata: {
      from: payload.from,
      subject: payload.subject,
      message_id: payload.message_id,
    },
  }]);

  return NextResponse.json({
    ok: true,
    case_id: caseId,
    updated: true,
  });
}

// TODO: Implement attachment handling
// async function handleAttachments(caseId: string, attachments: ZohoAttachment[]) {
//   // Upload to storage and create case_files records
// }
