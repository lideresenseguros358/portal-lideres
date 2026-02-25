/**
 * ADM COT — Client-side quote tracking helper
 * 
 * Fire-and-forget calls to /api/adm-cot/track
 * These never block the UI or throw errors to the user.
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

function detectRegion(): string | null {
  // Region is determined server-side from IP; placeholder for now
  return null;
}

async function trackCall(action: string, data: Record<string, any>) {
  try {
    await fetch('/api/adm-cot/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }),
    });
  } catch (err) {
    // Silent fail — tracking should never break the main flow
    console.warn('[ADM-COT] Track call failed:', err);
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
    region: detectRegion(),
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
 */
export function trackQuoteEmitted(params: {
  quoteRef: string;
  insurer: string;
  policyNumber?: string;
}) {
  trackCall('quote_emitted', {
    quote_ref: params.quoteRef,
    insurer: params.insurer,
    policy_number: params.policyNumber || null,
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
