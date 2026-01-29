/**
 * Endpoint de diagnóstico para probar catálogos IS
 * GET /api/is/test-catalogs
 */

import { NextResponse } from 'next/server';
import { getISBaseUrl, getISPrimaryToken } from '@/lib/is/config';

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  const baseUrl = getISBaseUrl('development');
  const token = getISPrimaryToken('development');

  // Test 1: Obtener marcas directamente
  try {
    console.log('[TEST] Probando endpoint de marcas...');
    const marcasResponse = await fetch(`${baseUrl}/api/cotizaemisorauto/getmarcas`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    const marcasText = await marcasResponse.text();
    let marcasData;
    try {
      marcasData = JSON.parse(marcasText);
    } catch {
      marcasData = marcasText;
    }

    results.tests.marcas = {
      status: marcasResponse.status,
      statusText: marcasResponse.statusText,
      ok: marcasResponse.ok,
      dataType: typeof marcasData,
      dataLength: Array.isArray(marcasData) ? marcasData.length : 'N/A',
      sample: Array.isArray(marcasData) ? marcasData.slice(0, 3) : marcasData,
      raw: marcasText.substring(0, 500),
    };
  } catch (error: any) {
    results.tests.marcas = {
      error: error.message,
      stack: error.stack,
    };
  }

  // Test 2: Obtener modelos directamente (con paginación)
  try {
    console.log('[TEST] Probando endpoint de modelos con paginación...');
    const modelosResponse = await fetch(`${baseUrl}/api/cotizaemisorauto/getmodelos/1/10`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    const modelosText = await modelosResponse.text();
    let modelosData;
    try {
      modelosData = JSON.parse(modelosText);
    } catch {
      modelosData = modelosText;
    }

    results.tests.modelos = {
      status: modelosResponse.status,
      statusText: modelosResponse.statusText,
      ok: modelosResponse.ok,
      dataType: typeof modelosData,
      dataLength: Array.isArray(modelosData) ? modelosData.length : 'N/A',
      sample: Array.isArray(modelosData) ? modelosData.slice(0, 3) : modelosData,
      raw: modelosText.substring(0, 500),
    };
  } catch (error: any) {
    results.tests.modelos = {
      error: error.message,
      stack: error.stack,
    };
  }

  // Test 3: Probar nuestra API interna
  try {
    console.log('[TEST] Probando nuestra API interna...');
    const internalResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/api/is/catalogs?type=marcas&env=development`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });

    const internalData = await internalResponse.json();

    results.tests.internalApi = {
      status: internalResponse.status,
      ok: internalResponse.ok,
      response: internalData,
    };
  } catch (error: any) {
    results.tests.internalApi = {
      error: error.message,
    };
  }

  return NextResponse.json(results, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
