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

  // Step 2: Probe ALL possible catalog endpoints for financieras/acreedores
  const endpoints = [
    '/catalogos/bancos',
    '/catalogos/financieras',
    '/catalogos/entidades',
    '/catalogos/entidadesfinancieras',
    '/catalogos/acreedores',
    '/catalogos/conducto',
    '/catalogos/conducto/1',
    '/catalogos/conducto/2',
    '/catalogos/conducto/3',
    '/catalogos/conducto/4',
    '/catalogos/tipoconducto',
    '/catalogos/conductores',
    '/cotizaemisorauto/gettipoconducto',
    '/cotizaemisorauto/getconducto',
    '/cotizaemisorauto/getconductores',
    '/cotizaemisorauto/getacreedores',
    '/cotizaemisorauto/getbancos',
    '/cotizaemisorauto/getfinancieras',
    '/cotizaemisorauto/getentidadesfinancieras',
    '/cotizaemisorauto/getconducto/1',
    '/cotizaemisorauto/getconducto/2',
    '/cotizaemisorauto/getconducto/3',
    '/cotizaemisorauto/getconducto/4',
  ];

  const results: Record<string, any> = {};

  for (const ep of endpoints) {
    const r = await isGet(ep, env);
    results[ep] = {
      success: r.success,
      status: r.statusCode,
      count: Array.isArray(r.data) ? r.data.length : (r.data?.Table ? r.data.Table.length : 0),
      data: r.success ? r.data : r.error,
    };
  }

  return NextResponse.json({ tokenStatus, results });
}
