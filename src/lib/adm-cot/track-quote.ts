/**
 * ADM COT — Client-side quote tracking helper
 * 
 * Fire-and-forget calls to /api/adm-cot/track
 * These never block the UI or throw errors to the user.
 * Includes retry + sendBeacon fallback to minimize lost events.
 */

function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'other';
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

async function trackCall(action: string, data: Record<string, any>) {
  const payload = JSON.stringify({ action, data });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('/api/adm-cot/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true, // survives page navigation
      });
      if (res.ok) return; // success
      // 401/403 — session issue, retry won't help
      if (res.status === 401 || res.status === 403) {
        console.warn(`[ADM-COT] Track ${action} auth error (${res.status}), using sendBeacon`);
        break;
      }
      // 5xx or other — retry
      console.warn(`[ADM-COT] Track ${action} attempt ${attempt + 1} failed (${res.status})`);
    } catch (err) {
      console.warn(`[ADM-COT] Track ${action} attempt ${attempt + 1} network error:`, err);
    }
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }

  // Final fallback: sendBeacon (works even during page unload)
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      navigator.sendBeacon('/api/adm-cot/track', new Blob([payload], { type: 'application/json' }));
    } catch { /* silent */ }
  }
}

/**
 * Track a newly generated quote (called after IS/FEDPA API returns successfully)
 */
export function trackQuoteCreated(params: {
  quoteRef: string;
  insurer: string;
  clientName: string;
  cedula?: string;
  email?: string;
  phone?: string;
  ramo?: string;
  coverageType?: string;
  planName?: string;
  annualPremium?: number;
  vehicleInfo?: Record<string, any>;
  quotePayload?: Record<string, any>;
}) {
  trackCall('quote_created', {
    quote_ref: params.quoteRef,
    client_name: params.clientName,
    cedula: params.cedula || null,
    email: params.email || null,
    phone: params.phone || null,
    device: detectDevice(),
    region: null, // resolved server-side from IP
    insurer: params.insurer,
    ramo: params.ramo || 'AUTO',
    coverage_type: params.coverageType || null,
    plan_name: params.planName || null,
    annual_premium: params.annualPremium || null,
    vehicle_info: params.vehicleInfo || null,
    quote_payload: params.quotePayload || null,
    last_step: 'comparar',
    steps_log: [{ step: 'comparar', ts: new Date().toISOString() }],
  });
}

/**
 * Track when emission succeeds
 * Passes cedula/email/phone so the DB record gets updated with data
 * entered during emission (which may not have been available at quote time)
 */
export function trackQuoteEmitted(params: {
  quoteRef: string;
  insurer: string;
  policyNumber?: string;
  cedula?: string;
  email?: string;
  phone?: string;
}) {
  trackCall('quote_emitted', {
    quote_ref: params.quoteRef,
    insurer: params.insurer,
    policy_number: params.policyNumber || null,
    cedula: params.cedula || null,
    email: params.email || null,
    phone: params.phone || null,
  });
}

/**
 * Track when emission fails
 */
export function trackQuoteFailed(params: {
  quoteRef: string;
  insurer: string;
  errorMessage?: string;
  errorEndpoint?: string;
  lastStep?: string;
}) {
  trackCall('quote_failed', {
    quote_ref: params.quoteRef,
    insurer: params.insurer,
    error_message: params.errorMessage || null,
    error_endpoint: params.errorEndpoint || null,
    last_step: params.lastStep || 'emitir',
  });
}

/**
 * Track funnel step progression
 */
export function trackStepUpdate(params: {
  quoteRef: string;
  insurer: string;
  step: string;
}) {
  trackCall('step_update', {
    quote_ref: params.quoteRef,
    insurer: params.insurer,
    step: params.step,
  });
}
