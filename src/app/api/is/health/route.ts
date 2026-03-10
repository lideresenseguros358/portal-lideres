/**
 * IS Health Check — diagnostic endpoint
 * GET /api/is/health
 * Tests token acquisition and a simple catalog call to verify IS connectivity.
 */

import { NextResponse } from 'next/server';
import { getISDefaultEnv, getISBaseUrl, getISPrimaryToken } from '@/lib/is/config';
import { getDailyTokenWithRetry } from '@/lib/is/token-manager';
import { isGet } from '@/lib/is/http-client';

export const maxDuration = 60;

export async function GET() {
  const env = getISDefaultEnv();
  const baseUrl = getISBaseUrl(env);
  const results: Record<string, any> = {
    env,
    baseUrl,
    VERCEL: process.env.VERCEL || 'undefined',
    VERCEL_ENV: process.env.VERCEL_ENV || 'undefined',
    timestamp: new Date().toISOString(),
  };

  // Test 1: Token
  try {
    const token = await getDailyTokenWithRetry(env);
    results.token = token ? `OK (${token.length} chars)` : 'FAILED (null)';
  } catch (e: any) {
    results.token = `ERROR: ${e.message}`;
  }

  // Test 2: Simple catalog call (getmarcas — lightweight)
  try {
    const t0 = Date.now();
    const r = await isGet('/cotizaemisorauto/getmarcas', env);
    results.catalog = {
      success: r.success,
      statusCode: r.statusCode,
      count: Array.isArray(r.data) ? r.data.length : (r.data?.Table?.length ?? 'N/A'),
      ms: Date.now() - t0,
    };
  } catch (e: any) {
    results.catalog = `ERROR: ${e.message}`;
  }

  // Test 3: Quick generarcotizacion (the actual problem endpoint)
  try {
    const { generarCotizacionAuto } = await import('@/lib/is/quotes.service');
    const t0 = Date.now();
    const r = await generarCotizacionAuto({
      codTipoDoc: 1,
      nroDoc: '8-000-0000',
      nroNit: '8-000-0000',
      nombre: 'HEALTH',
      apellido: 'CHECK',
      telefono: '60000000',
      correo: 'health@check.com',
      codMarca: 156,
      codModelo: 2563,
      anioAuto: String(new Date().getFullYear()),
      sumaAseg: '0',
      codPlanCobertura: 306,
      codPlanCoberturaAdic: 0,
      codGrupoTarifa: 20,
      fecNacimiento: '01/01/1990',
      codProvincia: 8,
    }, env);
    results.quote = {
      success: r.success,
      idCotizacion: r.idCotizacion || null,
      primaTotal: r.primaTotal || null,
      error: r.error || null,
      ms: Date.now() - t0,
    };
  } catch (e: any) {
    results.quote = `ERROR: ${e.message}`;
  }

  return NextResponse.json(results);
}
