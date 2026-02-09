/**
 * Rate Limiter + Circuit Breaker para Internacional de Seguros (IS)
 * 
 * - Rate limit global: max 2 req/s, 60/min por ambiente
 * - Catálogos GET: max 1 req/s (cacheables)
 * - Cotización POST: max 1 req cada 3s por usuario
 * - Circuit breaker: 5+ WAF/403/429 en 2 min → breaker 5 min
 */

import { ISEnvironment } from './config';

// ============================================
// RATE LIMITER (in-memory token bucket)
// ============================================

interface RateBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per second
}

const buckets: Map<string, RateBucket> = new Map();

function getBucket(key: string, maxTokens: number, refillRate: number): RateBucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: Date.now(), maxTokens, refillRate };
    buckets.set(key, bucket);
  }
  // Refill tokens based on elapsed time
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
  bucket.lastRefill = now;
  return bucket;
}

function tryConsume(key: string, maxTokens: number, refillRate: number): boolean {
  const bucket = getBucket(key, maxTokens, refillRate);
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

/**
 * Wait until rate limit allows, with max wait time
 */
async function waitForSlot(key: string, maxTokens: number, refillRate: number, maxWaitMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (tryConsume(key, maxTokens, refillRate)) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

// Rate limit configs
const RATE_LIMITS = {
  // Global: 2 req/s, burst of 4
  global: { maxTokens: 4, refillRate: 2 },
  // Catalogs: 1 req/s, burst of 2
  catalog: { maxTokens: 2, refillRate: 1 },
  // Quote POST: 1 req/3s, burst of 1
  quote: { maxTokens: 1, refillRate: 0.33 },
  // Token: 1 req/10s (very conservative)
  token: { maxTokens: 1, refillRate: 0.1 },
};

export type RateLimitCategory = 'global' | 'catalog' | 'quote' | 'token';

/**
 * Check rate limit before making IS API call.
 * Returns true if allowed, false if rate limited.
 * Will wait up to maxWaitMs for a slot.
 */
export async function checkRateLimit(
  env: ISEnvironment,
  category: RateLimitCategory = 'global',
  maxWaitMs = 5000
): Promise<boolean> {
  const config = RATE_LIMITS[category];
  const key = `is_${env}_${category}`;
  
  // Always check global first
  if (category !== 'global') {
    const globalOk = await waitForSlot(`is_${env}_global`, RATE_LIMITS.global.maxTokens, RATE_LIMITS.global.refillRate, maxWaitMs);
    if (!globalOk) {
      console.warn(`[IS RateLimit] Global rate limit hit for ${env}`);
      return false;
    }
  }
  
  const ok = await waitForSlot(key, config.maxTokens, config.refillRate, maxWaitMs);
  if (!ok) {
    console.warn(`[IS RateLimit] Rate limit hit: ${category} (${env})`);
  }
  return ok;
}

// ============================================
// CIRCUIT BREAKER (in-memory)
// ============================================

interface CircuitState {
  failures: number[];       // timestamps of recent failures
  openUntil: number | null; // timestamp when breaker closes
}

const circuits: Map<string, CircuitState> = new Map();

const CIRCUIT_CONFIG = {
  failureWindow: 2 * 60 * 1000,  // 2 minutes
  failureThreshold: 5,             // 5 failures in window
  openDuration: 5 * 60 * 1000,    // 5 minutes open
};

function getCircuit(env: ISEnvironment): CircuitState {
  const key = `is_circuit_${env}`;
  let state = circuits.get(key);
  if (!state) {
    state = { failures: [], openUntil: null };
    circuits.set(key, state);
  }
  return state;
}

/**
 * Check if circuit breaker allows requests
 */
export function isCircuitOpen(env: ISEnvironment): boolean {
  const state = getCircuit(env);
  
  if (state.openUntil) {
    if (Date.now() < state.openUntil) {
      return true; // Still open
    }
    // Breaker expired, reset
    state.openUntil = null;
    state.failures = [];
    console.log(`[IS Circuit] ✅ Breaker cerrado para ${env} — reanudando solicitudes`);
  }
  
  return false;
}

/**
 * Record a WAF/block failure. If threshold exceeded, open circuit.
 */
export function recordWafFailure(env: ISEnvironment): void {
  const state = getCircuit(env);
  const now = Date.now();
  
  // Add failure and clean old ones
  state.failures.push(now);
  state.failures = state.failures.filter(t => now - t < CIRCUIT_CONFIG.failureWindow);
  
  console.warn(`[IS Circuit] WAF failure #${state.failures.length}/${CIRCUIT_CONFIG.failureThreshold} (${env})`);
  
  if (state.failures.length >= CIRCUIT_CONFIG.failureThreshold) {
    state.openUntil = now + CIRCUIT_CONFIG.openDuration;
    console.error(`[IS Circuit] ⛔ BREAKER ABIERTO para ${env} — ${CIRCUIT_CONFIG.openDuration / 1000}s. No se harán solicitudes a IS.`);
  }
}

/**
 * Record a successful request (resets failure count)
 */
export function recordSuccess(env: ISEnvironment): void {
  const state = getCircuit(env);
  if (state.failures.length > 0) {
    state.failures = [];
  }
}

/**
 * Get circuit breaker status for monitoring
 */
export function getCircuitStatus(env: ISEnvironment): {
  isOpen: boolean;
  failures: number;
  openUntil: string | null;
  remainingMs: number;
} {
  const state = getCircuit(env);
  const open = isCircuitOpen(env);
  return {
    isOpen: open,
    failures: state.failures.length,
    openUntil: state.openUntil ? new Date(state.openUntil).toISOString() : null,
    remainingMs: state.openUntil ? Math.max(0, state.openUntil - Date.now()) : 0,
  };
}

// ============================================
// JITTER HELPER
// ============================================

/**
 * Exponential backoff with jitter
 * delays: ~800ms, ~2000ms, ~5000ms
 */
export function getBackoffDelay(attempt: number, baseDelays = [800, 2000, 5000]): number {
  const base = baseDelays[Math.min(attempt, baseDelays.length - 1)] ?? 5000;
  const jitter = Math.random() * 400; // 0-400ms jitter
  return base + jitter;
}
