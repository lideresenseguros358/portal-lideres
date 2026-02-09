/**
 * Vercel Cron: Refrescar token diario de IS
 * Ejecutar 1 vez al día temprano (ej: 6:00 AM EST)
 * 
 * vercel.json:
 * { "crons": [{ "path": "/api/cron/is-token", "schedule": "0 11 * * *" }] }
 * (11 UTC = 6 AM EST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { invalidateToken, getDailyTokenWithRetry } from '@/lib/is/token-manager';
import type { ISEnvironment } from '@/lib/is/config';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // Verificar que viene del cron de Vercel (o es local)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const results: Record<string, string> = {};
  
  for (const env of ['development', 'production'] as ISEnvironment[]) {
    try {
      invalidateToken(env);
      const token = await getDailyTokenWithRetry(env);
      results[env] = token ? `OK (${token.substring(0, 20)}...)` : 'FAILED';
    } catch (error: any) {
      results[env] = `ERROR: ${error.message}`;
    }
  }
  
  console.log('[IS Cron] Token refresh results:', results);
  
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
