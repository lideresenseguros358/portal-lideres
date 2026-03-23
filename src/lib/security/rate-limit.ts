/**
 * Rate Limiter — In-memory sliding window per IP
 * ================================================
 * Provides per-route and global rate limiting for public API endpoints.
 *
 * Usage:
 *   import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
 *
 *   const limiter = rateLimit(RATE_LIMITS.PUBLIC_API);
 *   export async function POST(req: NextRequest) {
 *     const rl = limiter(req);
 *     if (!rl.ok) return rl.response;
 *     ...
 *   }
 *
 * For Vercel serverless: in-memory limits reset per cold start.
 * For persistent rate limiting, use Vercel KV or Upstash Redis.
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  /** Max requests per window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Identifier prefix for bucket isolation */
  prefix?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Global store shared across all limiters within this process
const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL = 5 * 60_000;
let lastCleanup = Date.now();

function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
  // Hard cap: if store grows beyond 50k entries, clear it
  if (store.size > 50_000) store.clear();
}

/** Extract client IP from request, handling proxies safely */
export function getClientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; take only the FIRST IP (client)
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first && first !== 'unknown') return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

/** Pre-defined rate limit configs */
export const RATE_LIMITS = {
  /** General public API: 100 req/min/IP */
  PUBLIC_API: { max: 100, windowMs: 60_000, prefix: 'pub' } as RateLimitConfig,
  /** Chat endpoint: 30 req/min/IP (already had this) */
  CHAT: { max: 30, windowMs: 60_000, prefix: 'chat' } as RateLimitConfig,
  /** WhatsApp webhook: 60 req/min/IP (Meta can burst) */
  WHATSAPP: { max: 60, windowMs: 60_000, prefix: 'wa' } as RateLimitConfig,
  /** Webhooks (PagueloFacil, Zoho, tickets): 30 req/min/IP */
  WEBHOOK: { max: 30, windowMs: 60_000, prefix: 'wh' } as RateLimitConfig,
  /** Diagnostics/test: 10 req/min/IP */
  DIAGNOSTICS: { max: 10, windowMs: 60_000, prefix: 'diag' } as RateLimitConfig,
  /** Strict: login, forgot password, etc: 10 req/5min/IP */
  AUTH_STRICT: { max: 10, windowMs: 300_000, prefix: 'auth' } as RateLimitConfig,
};

/**
 * Create a rate limiter function for a given config.
 * Returns a function that takes a NextRequest and returns { ok, response }.
 */
export function rateLimit(config: RateLimitConfig) {
  return function check(req: NextRequest): { ok: true } | { ok: false; response: NextResponse } {
    cleanupStaleEntries();

    const ip = getClientIp(req);
    const key = `${config.prefix || 'rl'}:${ip}`;
    const now = Date.now();

    const entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + config.windowMs });
      return { ok: true };
    }

    if (entry.count >= config.max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      console.warn(`[RATE-LIMIT] Blocked ${ip} on ${config.prefix} (${entry.count}/${config.max})`);
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Demasiadas solicitudes. Intente más tarde.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfterSec),
              'X-RateLimit-Limit': String(config.max),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
            },
          },
        ),
      };
    }

    entry.count++;
    return { ok: true };
  };
}

// ════════════════════════════════════════════
// Global Traffic Anomaly Detection (Circuit Breaker)
// ════════════════════════════════════════════

interface TrafficWindow {
  count: number;
  uniqueIps: Set<string>;
  errorCount: number;
  startedAt: number;
}

const trafficWindow: TrafficWindow = {
  count: 0,
  uniqueIps: new Set(),
  errorCount: 0,
  startedAt: Date.now(),
};

const TRAFFIC_WINDOW_MS = 60_000; // 1 minute windows
const GLOBAL_RPS_THRESHOLD = 500; // If >500 req/min across all IPs → anomaly
const UNIQUE_IP_THRESHOLD = 200;  // If >200 unique IPs in 1 min → possible DDoS
const ERROR_RATE_THRESHOLD = 0.5; // If >50% errors → possible attack

/**
 * Record a request for global traffic analysis.
 * Returns true if traffic is normal, false if anomaly detected.
 */
export function recordTraffic(ip: string, isError: boolean = false): boolean {
  const now = Date.now();

  // Reset window if expired
  if (now - trafficWindow.startedAt > TRAFFIC_WINDOW_MS) {
    trafficWindow.count = 0;
    trafficWindow.uniqueIps.clear();
    trafficWindow.errorCount = 0;
    trafficWindow.startedAt = now;
  }

  trafficWindow.count++;
  trafficWindow.uniqueIps.add(ip);
  if (isError) trafficWindow.errorCount++;

  // Check for anomalies
  if (trafficWindow.count > GLOBAL_RPS_THRESHOLD) {
    if (trafficWindow.uniqueIps.size > UNIQUE_IP_THRESHOLD) {
      console.error(`[TRAFFIC-ANOMALY] Distributed attack suspected: ${trafficWindow.count} reqs from ${trafficWindow.uniqueIps.size} IPs in ${TRAFFIC_WINDOW_MS / 1000}s`);
      return false;
    }
  }

  if (trafficWindow.count > 50) {
    const errorRate = trafficWindow.errorCount / trafficWindow.count;
    if (errorRate > ERROR_RATE_THRESHOLD) {
      console.error(`[TRAFFIC-ANOMALY] High error rate: ${(errorRate * 100).toFixed(1)}% of ${trafficWindow.count} reqs`);
      return false;
    }
  }

  return true;
}

/**
 * Get current traffic stats (for monitoring/diagnostics).
 */
export function getTrafficStats() {
  return {
    windowStart: new Date(trafficWindow.startedAt).toISOString(),
    totalRequests: trafficWindow.count,
    uniqueIps: trafficWindow.uniqueIps.size,
    errorCount: trafficWindow.errorCount,
    errorRate: trafficWindow.count > 0 ? (trafficWindow.errorCount / trafficWindow.count) : 0,
    rateLimitStoreSize: store.size,
  };
}
