/**
 * Meta Ads — Conversions API (CAPI) Service
 * ==========================================
 * Server-side event tracking via Meta's Graph API.
 *
 * Endpoint: POST https://graph.facebook.com/v18.0/{PIXEL_ID}/events
 *
 * Events implemented:
 *   - Lead           → User generates an insurance quote
 *   - CompleteRegistration → Policy successfully emitted
 *   - ViewContent    → User views quote comparison page (future)
 *   - Purchase       → Payment confirmed (future)
 *
 * User data is hashed with SHA-256 as required by Meta.
 * Supports test_event_code for debugging in Events Manager.
 *
 * Reference: Meta Conversions API docs + guías en /public/Guia API META ADS
 */

import crypto from 'crypto';

const META_ADS_PIXEL_ID = process.env.META_ADS_PIXEL_ID || '';
const META_ADS_ACCESS_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const META_ADS_TEST_EVENT_CODE = process.env.META_ADS_TEST_EVENT_CODE || '';
const GRAPH_API_VERSION = 'v18.0';

// ════════════════════════════════════════════
// Types
// ════════════════════════════════════════════

export type MetaEventName =
  | 'Lead'
  | 'CompleteRegistration'
  | 'ViewContent'
  | 'SubmitApplication'
  | 'Purchase';

export interface MetaUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  country?: string;
  dateOfBirth?: string; // YYYYMMDD
  gender?: 'm' | 'f';
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string; // Meta click ID cookie
  fbp?: string; // Meta browser ID cookie
}

export interface MetaEventOptions {
  eventName: MetaEventName;
  eventId?: string;        // For deduplication with Pixel
  eventSourceUrl?: string;
  actionSource?: 'website' | 'app' | 'chat' | 'other';
  userData: MetaUserData;
  customData?: {
    currency?: string;     // ISO 4217 (e.g. "USD")
    value?: number;
    contentName?: string;
    contentCategory?: string;
    contents?: Array<{ id: string; quantity: number }>;
    orderId?: string;
    [key: string]: any;
  };
}

// ════════════════════════════════════════════
// Hashing (SHA-256, lowercase, trimmed)
// ════════════════════════════════════════════

function sha256(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex');
}

/**
 * Normalize phone to E.164-ish format before hashing.
 * Meta expects digits only, no +, no spaces.
 * Panama numbers: strip leading + and any non-digits.
 */
function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  // If it doesn't start with country code, assume Panama (+507)
  if (digits.length <= 8) {
    digits = '507' + digits;
  }
  return digits;
}

function buildUserData(ud: MetaUserData): Record<string, any> {
  const result: Record<string, any> = {};

  // Hashed fields
  if (ud.email) result.em = [sha256(ud.email)];
  if (ud.phone) result.ph = [sha256(normalizePhone(ud.phone))];
  if (ud.firstName) result.fn = sha256(ud.firstName);
  if (ud.lastName) result.ln = sha256(ud.lastName);
  if (ud.city) result.ct = sha256(ud.city);
  if (ud.state) result.st = sha256(ud.state);
  if (ud.country) result.country = sha256(ud.country);
  if (ud.dateOfBirth) result.db = sha256(ud.dateOfBirth);
  if (ud.gender) result.ge = sha256(ud.gender);

  // NOT hashed (per Meta spec)
  if (ud.clientIpAddress) result.client_ip_address = ud.clientIpAddress;
  if (ud.clientUserAgent) result.client_user_agent = ud.clientUserAgent;
  if (ud.fbc) result.fbc = ud.fbc;
  if (ud.fbp) result.fbp = ud.fbp;

  return result;
}

// ════════════════════════════════════════════
// Main function
// ════════════════════════════════════════════

/**
 * Send a server-side conversion event to Meta Ads via Conversions API.
 * Fire-and-forget — never throws; logs errors.
 */
export async function sendMetaConversionEvent(opts: MetaEventOptions): Promise<boolean> {
  if (!META_ADS_PIXEL_ID || !META_ADS_ACCESS_TOKEN) {
    console.warn('[META CAPI] Credentials not configured — event not sent:', opts.eventName);
    return false;
  }

  try {
    const eventTime = Math.floor(Date.now() / 1000);
    const eventId = opts.eventId || `${opts.eventName}_${eventTime}_${crypto.randomUUID()}`;

    const eventData: Record<string, any> = {
      event_name: opts.eventName,
      event_time: eventTime,
      event_id: eventId,
      action_source: opts.actionSource || 'website',
      user_data: buildUserData(opts.userData),
    };

    if (opts.eventSourceUrl) {
      eventData.event_source_url = opts.eventSourceUrl;
    }

    if (opts.customData) {
      eventData.custom_data = { ...opts.customData };
    }

    const payload: Record<string, any> = {
      data: [eventData],
    };

    // Include test event code if configured (for debugging in Events Manager)
    if (META_ADS_TEST_EVENT_CODE) {
      payload.test_event_code = META_ADS_TEST_EVENT_CODE;
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${META_ADS_PIXEL_ID}/events?access_token=${META_ADS_ACCESS_TOKEN}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[META CAPI] Error:', response.status, errText.substring(0, 300));
      return false;
    }

    const result = await response.json();
    console.log(`[META CAPI] ✅ ${opts.eventName} sent | event_id: ${eventId} | events_received: ${result.events_received}`);
    return true;
  } catch (err: any) {
    console.error('[META CAPI] Exception:', err.message);
    return false;
  }
}

// ════════════════════════════════════════════
// Convenience wrappers
// ════════════════════════════════════════════

/**
 * Fire a "Lead" event — user generated an insurance quote.
 */
export function trackLead(params: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  insurer?: string;
  ramo?: string;
  coverageType?: string;
  premium?: number;
  clientIp?: string;
  userAgent?: string;
  sourceUrl?: string;
  actionSource?: 'website' | 'chat';
}) {
  return sendMetaConversionEvent({
    eventName: 'Lead',
    actionSource: params.actionSource || 'website',
    eventSourceUrl: params.sourceUrl || 'https://portal.lideresenseguros.com/cotizadores',
    userData: {
      email: params.email,
      phone: params.phone,
      firstName: params.firstName,
      lastName: params.lastName,
      country: 'pa',
      clientIpAddress: params.clientIp,
      clientUserAgent: params.userAgent,
    },
    customData: {
      currency: 'USD',
      value: params.premium,
      contentName: [params.insurer, params.ramo, params.coverageType].filter(Boolean).join(' - '),
      contentCategory: params.ramo || 'AUTO',
    },
  });
}

/**
 * Fire a "CompleteRegistration" event — policy successfully emitted.
 */
export function trackCompleteRegistration(params: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  insurer?: string;
  ramo?: string;
  policyNumber?: string;
  premium?: number;
  clientIp?: string;
  userAgent?: string;
  sourceUrl?: string;
}) {
  return sendMetaConversionEvent({
    eventName: 'CompleteRegistration',
    actionSource: 'website',
    eventSourceUrl: params.sourceUrl || 'https://portal.lideresenseguros.com/cotizadores/confirmacion',
    userData: {
      email: params.email,
      phone: params.phone,
      firstName: params.firstName,
      lastName: params.lastName,
      country: 'pa',
      clientIpAddress: params.clientIp,
      clientUserAgent: params.userAgent,
    },
    customData: {
      currency: 'USD',
      value: params.premium,
      contentName: [params.insurer, params.ramo, params.policyNumber].filter(Boolean).join(' - '),
      contentCategory: params.ramo || 'AUTO',
      orderId: params.policyNumber,
    },
  });
}
