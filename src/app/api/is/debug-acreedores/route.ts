import { NextResponse } from 'next/server';
import { isGet } from '@/lib/is/http-client';
import { invalidateToken, getDailyTokenWithRetry } from '@/lib/is/token-manager';
import type { ISEnvironment } from '@/lib/is/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const env: ISEnvironment = 'development';

  // Step 1: Force fresh daily token
  invalidateToken(env);
  let tokenStatus = 'unknown';
  try {
    const token = await getDailyTokenWithRetry(env);
    tokenStatus = token ? `OK (${token.substring(0, 30)}...)` : 'FAILED';
  } catch (e: any) {
    tokenStatus = `ERROR: ${e.message}`;
  }

  // Step 2: Use isGet which handles token automatically
  const bancosResult = await isGet('/catalogos/bancos', env);

  return NextResponse.json({
    tokenStatus,
    bancos: {
      success: bancosResult.success,
      statusCode: bancosResult.statusCode,
      count: Array.isArray(bancosResult.data) ? bancosResult.data.length : 0,
      data: bancosResult.data,
      error: bancosResult.error,
    },
  });
}
