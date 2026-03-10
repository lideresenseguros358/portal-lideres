/**
 * IS Health Check — diagnostic endpoint
 * GET /api/is/health
 * Tests token, catalogs, DT plans, CC plans, and quote generation.
 */

import { NextResponse } from 'next/server';
import { getISDefaultEnv, getISBaseUrl } from '@/lib/is/config';
import { getDailyTokenWithRetry } from '@/lib/is/token-manager';
import { isGet } from '@/lib/is/http-client';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

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

  // Test 1: Daily token
  try {
    const token = await getDailyTokenWithRetry(env);
    results.token = token ? `OK (${token.length} chars)` : 'FAILED (null)';
  } catch (e: any) {
    results.token = `ERROR: ${e.message}`;
  }

  // Test 2: Catalog — getmarcas
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

  // Test 3: DT plans (getplanes/2)
  try {
    const r = await isGet('/cotizaemisorauto/getplanes/2', env);
    const plans = r.data?.Table || [];
    results.dtPlans = { count: plans.length, plans: plans.slice(0, 5).map((p: any) => `${p.TEXTO}=${p.DATO}`) };
  } catch (e: any) {
    results.dtPlans = `ERROR: ${e.message}`;
  }

  // Test 4: CC plans (getplanes/1)
  try {
    const r = await isGet('/cotizaemisorauto/getplanes/1', env);
    const plans = r.data?.Table || [];
    results.ccPlans = { count: plans.length, plans: plans.slice(0, 5).map((p: any) => `${p.TEXTO}=${p.DATO}`) };
  } catch (e: any) {
    results.ccPlans = `ERROR: ${e.message}`;
  }

  // Test 5: DT quote (plan 306, grupo 1=LIVIANO)
  try {
    const { generarCotizacionAuto } = await import('@/lib/is/quotes.service');
    const t0 = Date.now();
    const r = await generarCotizacionAuto({
      codTipoDoc: 1, nroDoc: '8-000-0000', nroNit: '8-000-0000',
      nombre: 'HEALTH', apellido: 'CHECK', telefono: '60000000',
      correo: 'health@check.com', codMarca: 156, codModelo: 2563,
      anioAuto: String(new Date().getFullYear()), sumaAseg: '0',
      codPlanCobertura: 306, codPlanCoberturaAdic: 0, codGrupoTarifa: 1,
      fecNacimiento: '01/01/1990', codProvincia: 8,
    }, env);
    results.quoteDT = { success: r.success, idCotizacion: r.idCotizacion || null, primaTotal: r.primaTotal || null, error: r.error || null, ms: Date.now() - t0 };
  } catch (e: any) {
    results.quoteDT = `ERROR: ${e.message}`;
  }

  // Test 6: CC quote (plan 29, grupo 20=PARTICULAR, sumaAseg=15000)
  try {
    const { generarCotizacionAuto } = await import('@/lib/is/quotes.service');
    const t0 = Date.now();
    const r = await generarCotizacionAuto({
      codTipoDoc: 1, nroDoc: '8-000-0001', nroNit: '8-000-0001',
      nombre: 'HEALTH', apellido: 'CCTEST', telefono: '60000001',
      correo: 'healthcc@check.com', codMarca: 156, codModelo: 2563,
      anioAuto: String(new Date().getFullYear()), sumaAseg: '15000',
      codPlanCobertura: 29, codPlanCoberturaAdic: 0, codGrupoTarifa: 20,
      fecNacimiento: '01/01/1990', codProvincia: 8,
    }, env);
    results.quoteCC = { success: r.success, idCotizacion: r.idCotizacion || null, primaTotal: r.primaTotal || null, error: r.error || null, ms: Date.now() - t0 };
  } catch (e: any) {
    results.quoteCC = `ERROR: ${e.message}`;
  }

  return NextResponse.json(results);
}
