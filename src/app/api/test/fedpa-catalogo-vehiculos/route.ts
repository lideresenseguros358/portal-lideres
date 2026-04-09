/**
 * Test Route: Descubrir catálogo de vehículos de EmisorPlan
 * GET /api/test/fedpa-catalogo-vehiculos?marca=TOY
 *
 * Prueba múltiples endpoints candidatos para encontrar el catálogo
 * de Marca/Modelo de FEDPA EmisorPlan. Los códigos reales son numéricos
 * según la documentación oficial ("Marca": "4", "Modelo": "10").
 *
 * Requiere CRON_SECRET en header Authorization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerClienteAutenticado } from '@/lib/fedpa/auth.service';
import { requireCronSecret } from '@/lib/security/api-guard';

const EMISOR_PLAN_BASE = 'https://wscanales.segfedpa.com/EmisorPlan';

const CATALOG_CANDIDATES = [
  '/api/marcas',
  '/api/modelos',
  '/api/catalogo',
  '/api/catalogos',
  '/api/vehiculos',
  '/api/vehiculos/marcas',
  '/api/vehiculos/modelos',
  '/api/auto/marcas',
  '/api/auto/modelos',
  '/api/autos/marcas',
  '/api/autos/modelos',
  '/api/catalogo/marcas',
  '/api/catalogo/modelos',
  '/api/tipos/marcas',
  '/api/tipos/modelos',
  '/api/marcasvehiculo',
  '/api/modelosvehiculo',
];

export async function GET(request: NextRequest) {
  const authErr = requireCronSecret(request);
  if (authErr) return authErr;

  const marcaFilter = request.nextUrl.searchParams.get('marca') || null;
  const results: any = {
    timestamp: new Date().toISOString(),
    endpoints_tried: [] as any[],
    found_catalogs: [] as any[],
  };

  // Get EmisorPlan token
  const clientResult = await obtenerClienteAutenticado('PROD');
  if (!clientResult.success || !clientResult.client) {
    return NextResponse.json({ success: false, error: `No token: ${clientResult.error}` }, { status: 424 });
  }

  const token = (clientResult.client as any).token || '';
  console.log('[Test Catalogo] Token obtenido, probando endpoints...');

  // Probe each candidate endpoint
  for (const path of CATALOG_CANDIDATES) {
    const url = `${EMISOR_PLAN_BASE}${path}${marcaFilter ? `?marca=${encodeURIComponent(marcaFilter)}` : ''}`;
    const entry: any = { path, url, status: null, hasData: false, sample: null };

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      entry.status = res.status;

      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data?.data || data?.marcas || data?.modelos || [];
        entry.hasData = arr.length > 0;
        entry.totalItems = arr.length;
        entry.sample = arr.slice(0, 3);
        entry.rawKeys = arr.length > 0 ? Object.keys(arr[0]) : [];

        if (arr.length > 0) {
          results.found_catalogs.push({ path, items: arr.length, sample: arr.slice(0, 5) });
          console.log(`[Test Catalogo] ✅ ENCONTRADO: ${path} → ${arr.length} items`);
        }
      } else {
        // Try to get error body
        try {
          const errBody = await res.text();
          entry.errorBody = errBody.substring(0, 200);
        } catch {}
      }
    } catch (e: any) {
      entry.status = 'TIMEOUT/ERROR';
      entry.error = e.message;
    }

    results.endpoints_tried.push(entry);
  }

  // Also try GET /api/marcas with a known brand code to see response
  if (marcaFilter) {
    const modelUrl = `${EMISOR_PLAN_BASE}/api/modelos?marca=${encodeURIComponent(marcaFilter)}`;
    try {
      const res = await fetch(modelUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        results.modelos_para_marca = { marca: marcaFilter, data };
      }
    } catch {}
  }

  results.summary = {
    total_tried: CATALOG_CANDIDATES.length,
    endpoints_found: results.found_catalogs.length,
    message: results.found_catalogs.length > 0
      ? `Catálogo encontrado en: ${results.found_catalogs.map((c: any) => c.path).join(', ')}`
      : 'Ningún endpoint de catálogo respondió — FEDPA EmisorPlan no expone catálogo de vehículos por API',
  };

  return NextResponse.json(results);
}
