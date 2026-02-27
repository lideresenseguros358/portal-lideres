/**
 * Fast token availability check — no generation, no retries.
 * GET /api/fedpa/auth/check?environment=DEV
 * Returns { hasToken: true/false } in <100ms.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkTokenDisponible } from '@/lib/fedpa/auth.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const environment = (searchParams.get('environment') || 'PROD') as FedpaEnvironment;

  const result = await checkTokenDisponible(environment);

  return NextResponse.json({ hasToken: result.hasToken }, { status: result.hasToken ? 200 : 404 });
}
