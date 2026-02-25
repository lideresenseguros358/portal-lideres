/**
 * ADM COT — Quote Tracking API (SECURED)
 * 
 * POST /api/adm-cot/track
 * 
 * Security layers:
 *  A. Session validation — user must be authenticated
 *  B. Origin validation — only portal.lideresenseguros.com + localhost
 *  C. Rate limiting — per IP, 60 req/min
 *  D. Payload validation — whitelist fields, sanitize, reject bad values
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ═══════════════════════════════════════
// A. SESSION VALIDATION
// ═══════════════════════════════════════

async function validateSession(): Promise<{ userId: string } | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* read-only in route handlers */ },
      },
    } as any);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return { userId: user.id };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════
// B. ORIGIN VALIDATION
// ═══════════════════════════════════════

const ALLOWED_ORIGINS = [
  'https://portal.lideresenseguros.com',
  'https://www.portal.lideresenseguros.com',
  'http://localhost:3000',
  'http://localhost:3001',
];

function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  // Allow if origin matches, or referer starts with allowed origin, or no origin (same-origin fetch)
  if (!origin && !referer) return true; // same-origin requests may omit origin
  if (ALLOWED_ORIGINS.some(o => origin === o || referer.startsWith(o))) return true;
  // In development, allow any localhost
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

// ═══════════════════════════════════════
// C. RATE LIMITING (in-memory, per IP)
// ═══════════════════════════════════════

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // max 60 requests per minute per IP

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

// Periodic cleanup (avoid memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 120_000);

// ═══════════════════════════════════════
// D. PAYLOAD VALIDATION
// ═══════════════════════════════════════

const VALID_ACTIONS = ['quote_created', 'quote_emitted', 'quote_failed', 'step_update'] as const;
const VALID_STATUSES = ['COTIZADA', 'EMITIDA', 'FALLIDA', 'ABANDONADA'] as const;
const VALID_INSURERS = ['INTERNACIONAL', 'FEDPA'] as const;
const VALID_RAMOS = ['AUTO', 'SALUD', 'VIDA', 'INCENDIO', 'RC', 'FIANZA'] as const;
const MAX_STRING_LEN = 500;

function sanitizeString(val: any, maxLen = MAX_STRING_LEN): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (s.length === 0) return null;
  // Strip potential XSS / injection
  return s.replace(/<[^>]*>/g, '').slice(0, maxLen);
}

function sanitizeNumber(val: any, min = 0, max = 999_999_999): number | null {
  if (val == null) return null;
  const n = Number(val);
  if (isNaN(n) || n < min || n > max) return null;
  return n;
}

function validateQuoteCreatedPayload(data: any): { valid: true; cleaned: Record<string, any> } | { valid: false; error: string } {
  if (!data.insurer || !VALID_INSURERS.includes(data.insurer)) {
    return { valid: false, error: `Invalid insurer: ${data.insurer}` };
  }
  const ramo = data.ramo || 'AUTO';
  if (!VALID_RAMOS.includes(ramo)) {
    return { valid: false, error: `Invalid ramo: ${ramo}` };
  }
  const premium = sanitizeNumber(data.annual_premium);
  if (data.annual_premium != null && premium === null) {
    return { valid: false, error: 'annual_premium must be a non-negative number' };
  }
  return {
    valid: true,
    cleaned: {
      quote_ref: sanitizeString(data.quote_ref) || `COT-${Date.now()}`,
      client_name: sanitizeString(data.client_name) || 'Anónimo',
      cedula: sanitizeString(data.cedula, 30),
      email: sanitizeString(data.email, 200),
      phone: sanitizeString(data.phone, 30),
      region: sanitizeString(data.region, 100),
      device: sanitizeString(data.device, 50),
      insurer: data.insurer,
      ramo,
      coverage_type: sanitizeString(data.coverage_type, 100),
      plan_name: sanitizeString(data.plan_name, 200),
      annual_premium: premium,
      vehicle_info: typeof data.vehicle_info === 'object' ? data.vehicle_info : null,
      quote_payload: typeof data.quote_payload === 'object' ? data.quote_payload : null,
      last_step: sanitizeString(data.last_step, 50) || 'comparar',
      steps_log: Array.isArray(data.steps_log) ? data.steps_log.slice(0, 50) : [{ step: 'comparar', ts: new Date().toISOString() }],
    },
  };
}

function validateUpdatePayload(data: any): { valid: true } | { valid: false; error: string } {
  if (!data.quote_ref) return { valid: false, error: 'Missing quote_ref' };
  if (!data.insurer || !VALID_INSURERS.includes(data.insurer)) {
    return { valid: false, error: `Invalid insurer: ${data.insurer}` };
  }
  return { valid: true };
}

// ═══════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    // — B. Origin check —
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }

    // — C. Rate limit —
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // — A. Session validation —
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // — Parse body —
    const body = await request.json();
    const { action, data } = body;

    if (!action || !data || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    switch (action) {
      // ═══════════════════════════════════════
      // 1. LOG NEW QUOTE
      // ═══════════════════════════════════════
      case 'quote_created': {
        const validation = validateQuoteCreatedPayload(data);
        if (!validation.valid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const { error } = await supabase.from('adm_cot_quotes').insert({
          ...validation.cleaned,
          ip_address: clientIp,
          user_agent: sanitizeString(request.headers.get('user-agent'), 1000),
          status: 'COTIZADA',
          quoted_at: new Date().toISOString(),
        });

        if (error) {
          console.error('[ADM-COT TRACK] Insert error:', error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, action: 'quote_created' });
      }

      // ═══════════════════════════════════════
      // 2. EMISSION SUCCESS
      // ═══════════════════════════════════════
      case 'quote_emitted': {
        const v = validateUpdatePayload(data);
        if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });

        const updates: Record<string, any> = {
          status: 'EMITIDA',
          emitted_at: new Date().toISOString(),
          last_step: 'confirmacion',
        };
        if (data.policy_number) {
          updates.quote_payload = {
            ...(typeof data.existing_payload === 'object' ? data.existing_payload : {}),
            nro_poliza: sanitizeString(data.policy_number, 100),
            payment_confirmed: true,
          };
        }

        const { error } = await supabase
          .from('adm_cot_quotes')
          .update(updates)
          .eq('quote_ref', data.quote_ref)
          .eq('insurer', data.insurer)
          .order('quoted_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('[ADM-COT TRACK] Emit update error:', error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, action: 'quote_emitted' });
      }

      // ═══════════════════════════════════════
      // 3. EMISSION FAILED
      // ═══════════════════════════════════════
      case 'quote_failed': {
        const v = validateUpdatePayload(data);
        if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });

        const { error } = await supabase
          .from('adm_cot_quotes')
          .update({
            status: 'FALLIDA',
            last_step: sanitizeString(data.last_step, 50) || 'emitir',
            quote_payload: {
              ...(typeof data.existing_payload === 'object' ? data.existing_payload : {}),
              error_code: sanitizeString(data.error_code, 50),
              error_message: sanitizeString(data.error_message, 500),
              error_endpoint: sanitizeString(data.error_endpoint, 200),
            },
          })
          .eq('quote_ref', data.quote_ref)
          .eq('insurer', data.insurer)
          .order('quoted_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('[ADM-COT TRACK] Fail update error:', error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, action: 'quote_failed' });
      }

      // ═══════════════════════════════════════
      // 4. STEP UPDATE (funnel)
      // ═══════════════════════════════════════
      case 'step_update': {
        const v = validateUpdatePayload(data);
        if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });
        const stepName = sanitizeString(data.step, 50);
        if (!stepName) return NextResponse.json({ error: 'Missing step' }, { status: 400 });

        const { data: existing } = await supabase
          .from('adm_cot_quotes')
          .select('steps_log')
          .eq('quote_ref', data.quote_ref)
          .eq('insurer', data.insurer)
          .order('quoted_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const currentSteps = Array.isArray(existing?.steps_log) ? (existing.steps_log as any[]) : [];
        currentSteps.push({ step: stepName, ts: new Date().toISOString() });

        const { error } = await supabase
          .from('adm_cot_quotes')
          .update({ last_step: stepName, steps_log: currentSteps.slice(-50) })
          .eq('quote_ref', data.quote_ref)
          .eq('insurer', data.insurer)
          .order('quoted_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('[ADM-COT TRACK] Step update error:', error.message);
        }
        return NextResponse.json({ success: true, action: 'step_update' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[ADM-COT TRACK] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
