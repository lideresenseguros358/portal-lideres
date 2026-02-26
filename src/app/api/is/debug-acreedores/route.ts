/**
 * TEMPORAL: Debug endpoint para extraer catálogo de acreedores de IS
 * Eliminar después de obtener los datos
 * 
 * GET /api/is/debug-acreedores
 */

import { NextResponse } from 'next/server';
import { isGet } from '@/lib/is/http-client';
import type { ISEnvironment } from '@/lib/is/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env: ISEnvironment = 'production';
  const results: Record<string, any> = {};

  // Probar todos los endpoints posibles para acreedores/conductos en IS
  const endpoints = [
    '/catalogos/tipoconducto',
    '/catalogos/conducto',
    '/catalogos/conducto/1',
    '/catalogos/conducto/2',
    '/catalogos/conducto/3',
    '/catalogos/conducto/4',
    '/catalogos/conductores',
    '/catalogos/acreedores',
    '/catalogos/bancos',
    '/catalogos/entidadesfinancieras',
    '/cotizaemisorauto/gettipoconducto',
    '/cotizaemisorauto/getconducto',
    '/cotizaemisorauto/getconducto/1',
    '/cotizaemisorauto/getconducto/2',
    '/cotizaemisorauto/getconducto/3',
    '/cotizaemisorauto/getconductores',
    '/cotizaemisorauto/getacreedores',
    '/cotizaemisorauto/getbancos',
    '/cotizaemisorauto/getentidades',
    '/cotizaemisorauto/getentidadesfinancieras',
  ];

  for (const ep of endpoints) {
    try {
      const response = await isGet(ep, env);
      results[ep] = {
        success: response.success,
        statusCode: response.statusCode,
        data: response.success ? response.data : response.error,
      };
    } catch (error: any) {
      results[ep] = { success: false, error: error.message };
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: env,
    results,
  });
}
