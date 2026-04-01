/**
 * API Endpoint: Cotización ANCON (CC + DT)
 * POST /api/ancon/cotizacion
 *
 * Returns parsed quote with options and coverages
 */

import { NextRequest, NextResponse } from 'next/server';
import { cotizarEstandar } from '@/lib/ancon/quotes.service';
import { resolveAnconVehicleCodes } from '@/lib/ancon/catalogs.service';
import type { AnconQuoteInput } from '@/lib/ancon/types';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      cod_marca,
      cod_modelo,
      ano,
      suma_asegurada,
      cod_producto,
      cedula,
      nombre,
      apellido,
      vigencia,
      email,
      tipo_persona,
      fecha_nac,
      nuevo,
      marca,   // Brand name string for IS→ANCON code resolution
      modelo,  // Model name string for IS→ANCON code resolution
    } = body;

    if (!cod_marca || !cod_modelo || !ano) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del vehículo (cod_marca, cod_modelo, ano)' },
        { status: 400 }
      );
    }

    // Resolve ANCON-specific vehicle codes from brand/model name strings.
    // IS numeric codes (e.g. 74 for Suzuki) are NOT valid in ANCON's catalog.
    let resolvedCodMarca = String(cod_marca).padStart(5, '0');
    let resolvedCodModelo = String(cod_modelo).padStart(5, '0');

    if (marca && modelo) {
      try {
        const resolved = await resolveAnconVehicleCodes(String(marca), String(modelo));
        if (resolved) {
          resolvedCodMarca = resolved.codMarca;
          resolvedCodModelo = resolved.codModelo;
          console.log(`[API ANCON Cotización] Vehicle resolved: "${marca}/${modelo}" → marca=${resolvedCodMarca}, modelo=${resolvedCodModelo} (${resolved.matchMethod})`);
        } else {
          console.warn(`[API ANCON Cotización] Could not resolve ANCON codes for "${marca}/${modelo}" — using IS codes as fallback`);
        }
      } catch (err: any) {
        console.warn(`[API ANCON Cotización] Vehicle resolution error for "${marca}/${modelo}":`, err.message, '— using IS codes as fallback');
      }
    }

    const input: AnconQuoteInput = {
      cod_marca: resolvedCodMarca,
      cod_modelo: resolvedCodModelo,
      ano: String(ano),
      suma_asegurada: String(suma_asegurada || '15000'),
      cod_producto: String(cod_producto || '00312'),
      cedula: cedula || '8-888-9999',
      nombre: (nombre || 'COTIZACION').toUpperCase(),
      apellido: (apellido || 'WEB').toUpperCase(),
      vigencia: vigencia || 'A',
      email: email || 'cotizacion@lideresenseguros.com',
      tipo_persona: tipo_persona || 'N',
      fecha_nac: fecha_nac || '16/06/1994',
      nuevo: String(nuevo ?? '0'),
    };

    console.log('[API ANCON Cotización] Input:', JSON.stringify(input).substring(0, 300));

    const result = await cotizarEstandar(input);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error cotizando ANCON' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      insurer: 'ANCON',
      ...result.data,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[API ANCON Cotización] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
