/**
 * WHATSAPP ENDPOINT — Meta WhatsApp Cloud API (Graph API)
 * ========================================================
 * Direct integration with Meta's official WhatsApp Cloud API.
 * No intermediary (Twilio removed).
 *
 * GET  /api/whatsapp — Webhook verification (Meta challenge)
 * POST /api/whatsapp — Incoming messages from WhatsApp Cloud API
 *
 * Pipeline: receive → save → classify (Vertex AI) → AI reply → send via Graph API
 *
 * Security:
 * - Meta webhook verify_token validation
 * - Input sanitization
 * - Rate limiting per phone
 * - Message deduplication
 * - Immediate 200 to Meta to avoid retries
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { processInboundMessage } from '@/lib/chat/chat-engine';
import { handleAdminCommand } from '@/lib/chat/admin-commands';
import { downloadWhatsAppMedia } from '@/lib/chat/media-download';

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

// Simple in-memory rate limiter (per phone, 20 msgs/min)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(phone, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

/**
 * Send a text message via Meta WhatsApp Cloud API (Graph API)
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<boolean> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('[WHATSAPP] Meta credentials not configured — reply not sent');
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: body.substring(0, 4096) },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[WHATSAPP] Graph API send error:', response.status, err.substring(0, 300));
      return false;
    }

    const data = await response.json();
    console.log('[WHATSAPP] Message sent to', to, '| id:', data?.messages?.[0]?.id);
    return true;
  } catch (err: any) {
    console.error('[WHATSAPP] Graph API send exception:', err.message);
    return false;
  }
}

// ═══════════════════════════════════════
// GET — Meta Webhook Verification
// ═══════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    console.log('[WHATSAPP] Webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('[WHATSAPP] Webhook verification failed', { mode, tokenMatch: token === WHATSAPP_VERIFY_TOKEN });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ═══════════════════════════════════════
// POST — Incoming WhatsApp Cloud API message
// ═══════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // CRITICAL: Return 200 immediately to Meta to prevent retries.
  // We process the message asynchronously after parsing.
  try {
    const body = await request.json();
    console.log('[WHATSAPP] ====== Incoming webhook ======');

    // Extract message from Meta WhatsApp Cloud API payload
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Status updates, read receipts, etc. — acknowledge without processing
    if (!value?.messages?.length) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const messageData = value.messages[0];
    const phone = messageData.from; // Sender phone (e.g. "507XXXXXXXX")
    const messageId = messageData.id; // Meta message ID (for dedup)
    const messageType = messageData.type; // text, image, audio, etc.
    const contactName = value?.contacts?.[0]?.profile?.name || null;

    // Supported message types
    const MEDIA_TYPES = ['audio', 'image', 'document'] as const;
    type MediaType = typeof MEDIA_TYPES[number];

    if (messageType !== 'text' && !MEDIA_TYPES.includes(messageType as MediaType)) {
      // PROTOCOLO 2B — Interceptar stickers, reacciones y otros tipos no soportados
      // con una respuesta amable en lugar de ignorarlos silenciosamente.
      console.log('[WHATSAPP] Unsupported message type intercepted:', messageType, '— sending friendly reply');
      await sendWhatsAppMessage(
        phone,
        'Hola 👋 Por favor, envíame tu consulta por escrito para poder ayudarte. No puedo procesar este tipo de mensaje.',
      );
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // ── Extract text or build descriptive body for media ──
    let messageText = '';
    let mediaParts: { mimeType: string; base64: string }[] | undefined;

    if (messageType === 'text') {
      const trimmed = messageData.text?.body?.trim();
      if (!trimmed) return NextResponse.json({ success: true }, { status: 200 });
      messageText = trimmed;
    } else {
      // audio | image | document
      const mediaObj = messageData[messageType as MediaType] as any;
      const mediaId: string | undefined = mediaObj?.id;
      const rawMime: string = mediaObj?.mime_type || 'application/octet-stream';
      const caption: string = mediaObj?.caption?.trim() || '';
      const filename: string = mediaObj?.filename || '';

      if (!mediaId) {
        console.warn('[WHATSAPP] Media message without id — ignored');
        return NextResponse.json({ success: true }, { status: 200 });
      }

      // Human-readable body stored in DB / shown in portal
      if (messageType === 'audio') {
        messageText = '[Nota de voz]';
      } else if (messageType === 'image') {
        messageText = caption ? `[Imagen: ${caption}]` : '[Imagen]';
      } else {
        messageText = filename ? `[Documento: ${filename}]` : '[Documento]';
        if (caption) messageText += ` — ${caption}`;
      }

      console.log(`[WHATSAPP] Media message — type=${messageType}, id=${mediaId}, mime=${rawMime}`);

      // Download and convert to base64 for Vertex AI
      const media = await downloadWhatsAppMedia(mediaId, rawMime);
      if (media) {
        mediaParts = [{ mimeType: media.mimeType, base64: media.base64 }];
      } else {
        // Download failed — Lissa tells the user
        await sendWhatsAppMessage(
          phone,
          'Recibí tu archivo, pero tuve un problema técnico para abrirlo 😅 ¿Podrías enviarlo nuevamente o escribirme tu consulta?',
        );
        return NextResponse.json({ success: true }, { status: 200 });
      }
    }

    // PROTOCOLO 2C — Final guard: never pass empty messageText to the pipeline.
    // Media messages always produce a non-empty descriptive body above, but
    // this guard catches any edge case (unknown media type, codec error, etc.)
    // BEFORE it can reach Vertex AI and cause "default message cannot be empty".
    if (!messageText || messageText.trim() === '') {
      console.warn('[WHATSAPP] Empty messageText after extraction — type:', messageType, '— sending friendly reply');
      await sendWhatsAppMessage(
        phone,
        'Por favor, envíame tu consulta por escrito para poder ayudarte. 😊',
      );
      return NextResponse.json({ success: true }, { status: 200 });
    }

    console.log('[WHATSAPP] From:', phone, '| Name:', contactName, '| Type:', messageType, '| Message:', messageText.substring(0, 100));

    // Admin command interception — runs BEFORE rate limiter and chat engine.
    // Only the ADMIN_PHONE_NUMBER can trigger commands. Clients sending '/'
    // messages will have them treated as plain text (handled: false).
    const cmdResult = await handleAdminCommand(phone, messageText);
    if (cmdResult.handled) {
      if (cmdResult.reply) {
        await sendWhatsAppMessage(phone, cmdResult.reply);
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Rate limit
    if (!checkRateLimit(phone)) {
      console.warn('[WHATSAPP] Rate limited:', phone);
      await sendWhatsAppMessage(phone, 'Ha enviado muchos mensajes en poco tiempo. Por favor espere un momento antes de intentar de nuevo.');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Process through Chat Engine pipeline (Vertex AI classification + reply)
    console.log('[WHATSAPP] Processing via chat-engine...');
    const result = await processInboundMessage({
      fromPhone: phone,
      toPhone: WHATSAPP_PHONE_NUMBER_ID,
      body: messageText,
      profileName: contactName || undefined,
      providerMessageId: messageId || undefined,
      channel: 'whatsapp',
      mediaParts,
    });

    console.log('[WHATSAPP] Thread:', result.threadId, '| Category:', result.classification.category, '| Severity:', result.classification.severity);

    // If AI generated a reply, send it via Meta Graph API
    if (result.aiReply && result.aiReplySent) {
      // PROTOCOLO 2B (guardia final) — nunca enviar body vacío a Meta Graph API.
      const safeReply = result.aiReply.trim();
      if (!safeReply) {
        console.error('[WHATSAPP] AI reply is empty after trim — sending fallback to avoid Meta 400');
        await sendWhatsAppMessage(
          phone,
          'Disculpa, tuve un problema técnico momentáneo. Puedes escribirnos a contacto@lideresenseguros.com o llamar al 223-2373. 💚',
        );
      } else {
        const sent = await sendWhatsAppMessage(phone, safeReply);
        console.log('[WHATSAPP] AI reply sent:', sent, '| Duration:', Date.now() - startTime, 'ms');
      }
    } else {
      console.log('[WHATSAPP] No AI reply (ai_enabled=false or assigned to master). Duration:', Date.now() - startTime, 'ms');
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error('[WHATSAPP] Webhook error:', err.message, err.stack);
    // Always return 200 to Meta to prevent retries
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
