/**
 * API Route Guards
 * ================
 * Lightweight auth guards for API routes that aren't covered by the main middleware.
 * Use these in diagnostics, test, and internal-only endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from './rate-limit';

/**
 * Require CRON_SECRET for access (used by diagnostics and test endpoints).
 * Returns null if authorized, or a 401 response if not.
 */
export function requireCronSecret(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[API-GUARD] CRON_SECRET not configured — blocking request');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const xCronSecret = req.headers.get('x-cron-secret');
  const provided = authHeader?.replace('Bearer ', '') || xCronSecret;

  if (provided !== cronSecret) {
    console.warn(`[API-GUARD] Unauthorized access attempt from IP: ${getClientIp(req)} to ${req.nextUrl.pathname}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null; // Authorized
}

/**
 * Block access in production unless CRON_SECRET is provided.
 * In development, allow access freely.
 */
export function requireDevOrSecret(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === 'development') return null;
  return requireCronSecret(req);
}
