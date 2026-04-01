/**
 * Meta Ads — Conversions API (CAPI) Service
 * ==========================================
 * Server-side event tracking using the official facebook-nodejs-business-sdk.
 *
 * Events:
 *   - Lead                → New quote inserted in adm_cot_quotes (status=COTIZADA)
 *   - CompleteRegistration → Quote updated to EMITIDA (policy issued)
 *
 * Deduplication: Uses the adm_cot_quotes.id (UUID) as event_id so Meta
 * never counts the same lead/registration twice, even if the backend
 * retries or the client fires a Pixel event with the same ID.
 *
 * All PII is hashed SHA-256 by the SDK automatically.
 * test_event_code is forwarded when META_ADS_TEST_EVENT_CODE is set.
 */

import bizSdk from 'facebook-nodejs-business-sdk';

const {
  Content,
  CustomData,
  EventRequest,
  UserData,
  ServerEvent,
} = bizSdk;

// ════════════════════════════════════════════
// Config
// ════════════════════════════════════════════

const PIXEL_ID = process.env.META_ADS_PIXEL_ID || '';
const ACCESS_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const TEST_EVENT_CODE = process.env.META_ADS_TEST_EVENT_CODE || '';

// ════════════════════════════════════════════
// Types
// ════════════════════════════════════════════

export type MetaEventName = 'Lead' | 'CompleteRegistration' | 'InitiateCheckout';

export interface CAPIEventParams {
  /** Unique DB ID for deduplication (adm_cot_quotes.id) */
  quoteId: string;
  eventName: MetaEventName;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  /** Premium amount in USD */
  value?: number;
  /** e.g. "FEDPA - AUTO - Cobertura Completa" */
  contentName?: string;
  contentCategory?: string;
  clientIp?: string;
  userAgent?: string;
  sourceUrl?: string;
}

// ════════════════════════════════════════════
// Phone normalisation (Panama)
// ════════════════════════════════════════════

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length <= 8) digits = '507' + digits;
  return digits;
}

// ════════════════════════════════════════════
// Core sender
// ════════════════════════════════════════════

/**
 * Send a server-side conversion event to Meta via the official SDK.
 * Fire-and-forget — never throws to the caller.
 */
export async function sendCapiEvent(params: CAPIEventParams): Promise<{
  success: boolean;
  eventsReceived?: number;
  error?: string;
}> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    const msg = 'META CAPI credentials not configured';
    console.warn(`[META CAPI] ${msg} — event ${params.eventName} not sent`);
    return { success: false, error: msg };
  }

  // Meta requires at least one hashed PII field (email or phone) beyond country
  if (!params.email && !params.phone) {
    const msg = 'No email or phone — insufficient user data for Meta CAPI';
    console.warn(`[META CAPI] ${msg} — event ${params.eventName} skipped (quote=${params.quoteId})`);
    return { success: false, error: msg };
  }

  try {
    bizSdk.FacebookAdsApi.init(ACCESS_TOKEN);

    const currentTimestamp = Math.floor(Date.now() / 1000);

    // ── User Data (SDK hashes automatically) ──
    const userData = new UserData();
    if (params.email) userData.setEmail(params.email.trim().toLowerCase());
    if (params.phone) userData.setPhone(normalizePhone(params.phone));
    if (params.firstName) userData.setFirstName(params.firstName.trim().toLowerCase());
    if (params.lastName) userData.setLastName(params.lastName.trim().toLowerCase());
    userData.setCountry('pa');
    if (params.clientIp) userData.setClientIpAddress(params.clientIp);
    if (params.userAgent) userData.setClientUserAgent(params.userAgent);

    // ── Custom Data ──
    const customData = new CustomData();
    customData.setCurrency('USD');
    if (params.value != null && params.value > 0) {
      customData.setValue(params.value);
    }
    if (params.contentName) customData.setContentName(params.contentName);
    if (params.contentCategory) customData.setContentCategory(params.contentCategory);

    // ── Server Event ──
    const serverEvent = new ServerEvent();
    serverEvent.setEventName(params.eventName);
    serverEvent.setEventTime(currentTimestamp);
    serverEvent.setEventId(params.quoteId); // deduplication key
    serverEvent.setActionSource('website');
    serverEvent.setUserData(userData);
    serverEvent.setCustomData(customData);
    if (params.sourceUrl) {
      serverEvent.setEventSourceUrl(params.sourceUrl);
    }

    // ── Event Request ──
    const eventRequest = new EventRequest(ACCESS_TOKEN, PIXEL_ID);
    eventRequest.setEvents([serverEvent]);
    if (TEST_EVENT_CODE) {
      eventRequest.setTestEventCode(TEST_EVENT_CODE);
    }

    const response = await eventRequest.execute();
    const received = response?.events_received ?? 0;

    console.log(
      `[META CAPI] ✅ ${params.eventName} | quote=${params.quoteId} | events_received=${received}` +
      (TEST_EVENT_CODE ? ` | test_code=${TEST_EVENT_CODE}` : '')
    );

    return { success: true, eventsReceived: received };
  } catch (err: any) {
    const errMsg = err?.response?.error?.message || err?.message || String(err);
    console.error(`[META CAPI] ❌ ${params.eventName} | quote=${params.quoteId} | error: ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

// ════════════════════════════════════════════
// Convenience wrappers
// ════════════════════════════════════════════

/**
 * Fire "Lead" — called after a new quote is confirmed inserted in adm_cot_quotes.
 */
export function trackLead(params: {
  quoteId: string;
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
}) {
  return sendCapiEvent({
    quoteId: params.quoteId,
    eventName: 'Lead',
    email: params.email,
    phone: params.phone,
    firstName: params.firstName,
    lastName: params.lastName,
    value: params.premium,
    contentName: [params.insurer, params.ramo, params.coverageType].filter(Boolean).join(' - ') || undefined,
    contentCategory: params.ramo || 'AUTO',
    clientIp: params.clientIp,
    userAgent: params.userAgent,
    sourceUrl: 'https://portal.lideresenseguros.com/cotizadores',
  });
}

/**
 * Fire "InitiateCheckout" — called when a quote is abandoned (status → ABANDONADA).
 * Standard Meta event for checkout/purchase abandonment; enables retargeting audiences.
 */
export function trackAbandonedCheckout(params: {
  quoteId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  insurer?: string;
  ramo?: string;
  coverageType?: string;
  premium?: number;
  lastStep?: string;
  clientIp?: string;
  userAgent?: string;
}) {
  return sendCapiEvent({
    quoteId: `${params.quoteId}_abandon`,
    eventName: 'InitiateCheckout',
    email: params.email,
    phone: params.phone,
    firstName: params.firstName,
    lastName: params.lastName,
    value: params.premium,
    contentName: [params.insurer, params.ramo, params.coverageType, params.lastStep ? `abandonó en: ${params.lastStep}` : ''].filter(Boolean).join(' - ') || undefined,
    contentCategory: params.ramo || 'AUTO',
    clientIp: params.clientIp,
    userAgent: params.userAgent,
    sourceUrl: 'https://portal.lideresenseguros.com/cotizadores/emitir',
  });
}

/**
 * Fire "CompleteRegistration" — called after quote status flips to EMITIDA.
 */
export function trackCompleteRegistration(params: {
  quoteId: string;
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
}) {
  return sendCapiEvent({
    quoteId: `${params.quoteId}_emit`,
    eventName: 'CompleteRegistration',
    email: params.email,
    phone: params.phone,
    firstName: params.firstName,
    lastName: params.lastName,
    value: params.premium,
    contentName: [params.insurer, params.ramo, params.policyNumber].filter(Boolean).join(' - ') || undefined,
    contentCategory: params.ramo || 'AUTO',
    clientIp: params.clientIp,
    userAgent: params.userAgent,
    sourceUrl: 'https://portal.lideresenseguros.com/cotizadores/confirmacion',
  });
}
