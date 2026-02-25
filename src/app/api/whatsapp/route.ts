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

// Empty TwiML response — tells Twilio "don't send any additional message"
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
function twimlResponse(status = 200) {
  return new NextResponse(EMPTY_TWIML, {
    status,
    headers: { 'Content-Type': 'text/xml' },
  });
}
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
 * Twilio signs: URL + sorted(key+value) pairs from the POST body.
 * The values must be the fully decoded form values.
 * Behind Vercel, req.url is internal — we MUST use the exact public webhook URL.
 */
function validateTwilioSignature(req: NextRequest, body: string): boolean {
  // Allow bypassing signature validation while token is being fixed
  // Set SKIP_TWILIO_SIGNATURE=true in Vercel env vars to enable
  if (process.env.SKIP_TWILIO_SIGNATURE === 'true') {
    console.warn('[WHATSAPP] Signature validation SKIPPED (SKIP_TWILIO_SIGNATURE=true) — fix TWILIO_AUTH_TOKEN and remove this flag');
    return true;
  }

  if (!TWILIO_AUTH_TOKEN) {
    console.warn('[WHATSAPP] No TWILIO_AUTH_TOKEN — skipping signature validation');
    return true;
  }

  const twilioSignature = req.headers.get('x-twilio-signature');
  if (!twilioSignature) {
    console.warn('[WHATSAPP] No x-twilio-signature header present');
    return false;
  }

  const url = WEBHOOK_PUBLIC_URL;

  // Parse raw form body into a map of decoded key-value pairs
  // Twilio spec: sort params by key, concatenate key+value (decoded)
  const paramPairs: Record<string, string> = {};
  if (body) {
    const pairs = body.split('&');
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const key = decodeURIComponent(pair.substring(0, eqIdx).replace(/\+/g, ' '));
      const val = decodeURIComponent(pair.substring(eqIdx + 1).replace(/\+/g, ' '));
      paramPairs[key] = val;
    }
  }

  // Build signature string: URL + sorted key+value
  const sortedKeys = Object.keys(paramPairs).sort();
  let signatureString = url;
  for (const key of sortedKeys) {
    signatureString += key + paramPairs[key];
  }

  const expectedSignature = crypto
    .createHmac('sha1', TWILIO_AUTH_TOKEN)
    .update(signatureString)
    .digest('base64');

  const valid = twilioSignature === expectedSignature;
  if (!valid) {
    // Try alternate URLs — Twilio might sign against a different variant
    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
    const altUrls = new Set([
      url,
      url + '/',
      url.replace('https://', 'http://'),
      req.url,                                          // Vercel internal URL
      req.nextUrl.toString(),                            // Next.js resolved URL
      ...(forwardedHost ? [
        `${forwardedProto}://${forwardedHost}/api/whatsapp`,
        `https://${forwardedHost}/api/whatsapp`,
      ] : []),
    ]);

    for (const alt of altUrls) {
      if (alt === url) continue; // already tried
      let altSig = alt;
      for (const key of sortedKeys) altSig += key + paramPairs[key];
      const altExpected = crypto.createHmac('sha1', TWILIO_AUTH_TOKEN).update(altSig).digest('base64');
      if (altExpected === twilioSignature) {
        console.warn('[WHATSAPP] Signature matched with alternate URL:', alt, '— update WHATSAPP_WEBHOOK_URL env var to this value');
        return true;
      }
    }

    console.warn('[WHATSAPP] Signature mismatch — no URL variant matched', {
      received: twilioSignature,
      expected: expectedSignature,
      configuredUrl: url,
      reqUrl: req.url,
      forwardedHost,
      tokenPrefix: TWILIO_AUTH_TOKEN.substring(0, 4) + '...',
      paramKeys: sortedKeys,
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
      return twimlResponse(403);
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
      return twimlResponse();
    }

    // Rate limit
    const phone = from.replace(/^whatsapp:/i, '');
    if (!checkRateLimit(phone)) {
      console.warn('[WHATSAPP] Rate limited:', phone);
      await sendTwilioReply(from, 'Ha enviado muchos mensajes en poco tiempo. Por favor espere un momento antes de intentar de nuevo.');
      return twimlResponse();
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

    // Always return empty TwiML to Twilio
    return twimlResponse();
  } catch (err: any) {
    console.error('[WHATSAPP] Webhook error:', err.message, err.stack);
    // Always return empty TwiML to avoid retries
    return twimlResponse();
  }
}
