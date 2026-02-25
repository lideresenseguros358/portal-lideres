/**
 * WHATSAPP ENDPOINT — Twilio Webhook
 * ====================================
 * Receives incoming WhatsApp messages from Twilio.
 * Processes via shared chatProcessor pipeline.
 * Responds via Twilio REST API.
 * 
 * Security:
 * - Twilio signature validation
 * - Input sanitization
 * - Rate limiting per phone
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { processMessage } from '@/lib/chatProcessor';
import crypto from 'crypto';

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || '';
// The public URL that Twilio signs against — MUST match webhook config exactly
const WEBHOOK_PUBLIC_URL = process.env.WHATSAPP_WEBHOOK_URL || 'https://portal.lideresenseguros.com/api/whatsapp';

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
 * Validate Twilio request signature
 * 
 * CRITICAL: Behind Vercel, req.url is the internal URL, NOT the public URL
 * that Twilio signed. We MUST use the exact public webhook URL.
 */
function validateTwilioSignature(req: NextRequest, body: string): boolean {
  if (!TWILIO_AUTH_TOKEN) {
    console.warn('[WHATSAPP] No TWILIO_AUTH_TOKEN — skipping signature validation');
    return true; // Allow in dev
  }

  const twilioSignature = req.headers.get('x-twilio-signature');
  if (!twilioSignature) {
    console.warn('[WHATSAPP] No x-twilio-signature header present');
    return false;
  }

  // Use the PUBLIC webhook URL — not req.url (which is Vercel internal)
  const url = WEBHOOK_PUBLIC_URL;

  // Parse form body into sorted params for signature
  const params = new URLSearchParams(body);
  const keys = Array.from(params.keys()).sort();

  // Build signature string: URL + sorted key=value pairs
  let signatureString = url;
  for (const key of keys) {
    signatureString += key + (params.get(key) || '');
  }

  const expectedSignature = crypto
    .createHmac('sha1', TWILIO_AUTH_TOKEN)
    .update(signatureString)
    .digest('base64');

  const valid = twilioSignature === expectedSignature;
  if (!valid) {
    console.warn('[WHATSAPP] Signature mismatch', {
      received: twilioSignature,
      expected: expectedSignature,
      url,
    });
  }
  return valid;
}

/**
 * Send reply via Twilio REST API
 */
async function sendTwilioReply(to: string, body: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    console.warn('[WHATSAPP] Twilio credentials not configured — reply not sent');
    return false;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authString = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:') ? TWILIO_WHATSAPP_NUMBER : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
        To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
        Body: body.substring(0, 1600), // Twilio limit
      }).toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[WHATSAPP] Twilio send error:', err);
      return false;
    }

    console.log('[WHATSAPP] Reply sent to', to);
    return true;
  } catch (err: any) {
    console.error('[WHATSAPP] Twilio send exception:', err.message);
    return false;
  }
}

// ═══════════════════════════════════════
// POST — Twilio webhook
// ═══════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    console.log('[WHATSAPP] ====== Incoming webhook ======');
    const rawBody = await request.text();
    console.log('[WHATSAPP] Body length:', rawBody.length);

    // Validate Twilio signature
    if (!validateTwilioSignature(request, rawBody)) {
      console.warn('[WHATSAPP] Invalid Twilio signature — rejecting');
      return new NextResponse('Forbidden', { status: 403 });
    }
    console.log('[WHATSAPP] Signature valid');

    // Parse form-urlencoded body
    const params = new URLSearchParams(rawBody);
    const messageBody = params.get('Body') || '';
    const from = params.get('From') || ''; // whatsapp:+507XXXXXXXX
    const profileName = params.get('ProfileName') || null;

    console.log('[WHATSAPP] From:', from, '| Profile:', profileName, '| Message:', messageBody.substring(0, 100));

    if (!messageBody.trim() || !from) {
      console.log('[WHATSAPP] Empty message or no From — ignoring');
      return new NextResponse('OK', { status: 200 });
    }

    // Rate limit
    const phone = from.replace(/^whatsapp:/i, '');
    if (!checkRateLimit(phone)) {
      console.warn('[WHATSAPP] Rate limited:', phone);
      await sendTwilioReply(from, 'Ha enviado muchos mensajes en poco tiempo. Por favor espere un momento antes de intentar de nuevo.');
      return new NextResponse('OK', { status: 200 });
    }

    // Process message through pipeline
    console.log('[WHATSAPP] Processing via chatProcessor...');
    const result = await processMessage({
      message: messageBody,
      channel: 'whatsapp',
      phone,
    });
    console.log('[WHATSAPP] Intent:', result.intent, '| Escalated:', result.escalated, '| LogId:', result.logId);

    // Send reply via Twilio
    const sent = await sendTwilioReply(from, result.reply);
    console.log('[WHATSAPP] Reply sent:', sent, '| Duration:', Date.now() - startTime, 'ms');

    // Always return 200 to Twilio
    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('[WHATSAPP] Webhook error:', err.message, err.stack);
    // Always return 200 to Twilio to avoid retries
    return new NextResponse('OK', { status: 200 });
  }
}
