/**
 * ADM COT — WhatsApp Business Webhook Stub
 * 
 * Prepared for future WhatsApp Business integration.
 * When connected, this endpoint will:
 *   1. Receive incoming messages via webhook
 *   2. Create/find conversation with source=WHATSAPP
 *   3. Process through the same OpenAI pipeline
 *   4. Send reply back via WhatsApp Business API
 * 
 * GET  — Webhook verification (Meta challenge)
 * POST — Incoming message processing
 */

import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';

// ═══════════════════════════════════════
// GET — Webhook verification (Meta)
// ═══════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WHATSAPP WEBHOOK] Verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ═══════════════════════════════════════
// POST — Incoming message
// ═══════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log incoming webhook for debugging
    console.log('[WHATSAPP WEBHOOK] Incoming:', JSON.stringify(body).slice(0, 500));

    // Extract message data from WhatsApp webhook format
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageData = value?.messages?.[0];

    if (!messageData) {
      // Status updates, read receipts, etc. — acknowledge without processing
      return NextResponse.json({ success: true, message: 'No message to process' });
    }

    const phone = messageData.from; // Sender phone number
    const messageText = messageData.text?.body || '';
    const messageType = messageData.type; // text, image, etc.
    const contactName = value?.contacts?.[0]?.profile?.name || null;

    if (messageType !== 'text' || !messageText) {
      // Only process text messages for now
      return NextResponse.json({ success: true, message: 'Non-text message ignored' });
    }

    // TODO: When WhatsApp integration is active, uncomment and connect:
    //
    // 1. Find or create conversation:
    //    const convRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/adm-cot/chat/process`, {
    //      method: 'POST',
    //      headers: { 'Content-Type': 'application/json' },
    //      body: JSON.stringify({
    //        action: 'process_message',
    //        message: messageText,
    //        source: 'WHATSAPP',
    //        phone,
    //        client_name: contactName,
    //      }),
    //    });
    //
    // 2. Send reply via WhatsApp Business API:
    //    const replyData = await convRes.json();
    //    await sendWhatsAppMessage(phone, replyData.data.reply);

    console.log(`[WHATSAPP WEBHOOK] Message from ${phone}: "${messageText.slice(0, 100)}"`);

    return NextResponse.json({ success: true, message: 'Webhook received — WhatsApp integration pending' });
  } catch (e: any) {
    console.error('[WHATSAPP WEBHOOK] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
