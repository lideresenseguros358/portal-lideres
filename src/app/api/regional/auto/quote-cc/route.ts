/**
 * API Endpoint: Cotización Cobertura Completa REGIONAL
 * POST /api/regional/auto/quote-cc
 *
 * Generates a CC quote via POST /regional/auto/cotizacion
 */

import { NextRequest, NextResponse } from 'next/server';
import { cotizarCC } from '@/lib/regional/quotes.service';
import { resolveRegionalVehicleCodes } from '@/lib/cotizadores/regional-vehicle-mapper';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  try {
    const body = await request.json();

    const {
      nombre, apellido, edad, sexo, edocivil,
      tppersona, tpodoc, prov, letra, tomo, asiento, dv, pasaporte,
      telefono, celular, email,
      vehnuevo, codMarca, codModelo, anio, valorVeh, numPuestos,
      endoso, lesiones, danios, gastosMedicos,
      marca, modelo, // Brand/model names for IS→Regional normalization
    } = body;

    // Validations
    if (!nombre || !apellido || !edad) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del cliente (nombre, apellido, edad)' },
        { status: 400 }
      );
    }
    if (!codMarca || !codModelo || !anio || !valorVeh) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del vehículo (codMarca, codModelo, anio, valorVeh)' },
        { status: 400 }
      );
    }

    console.log(`[REGIONAL CC Quote] Iniciando cotización CC endoso=${endoso}...`);

    // ═══ Normalize IS vehicle codes → Regional codes ═══
    let resolvedMarca = parseInt(codMarca);
    let resolvedModelo = parseInt(codModelo);

    if (marca || modelo) {
      try {
        const resolved = await resolveRegionalVehicleCodes({
          isMarcaCodigo: parseInt(codMarca),
          isModeloCodigo: parseInt(codModelo),
          marcaNombre: marca || '',
          modeloNombre: modelo || '',
        });
        resolvedMarca = resolved.codMarca;
        resolvedModelo = resolved.codModelo;
        console.log(`[REGIONAL CC Quote] Vehicle codes normalized: marca ${codMarca}→${resolvedMarca}, modelo ${codModelo}→${resolvedModelo} (${resolved.matchMethod})`);
        if (resolved.warning) {
          console.warn(`[REGIONAL CC Quote] ⚠️ ${resolved.warning}`);
        }
      } catch (err) {
        console.warn('[REGIONAL CC Quote] Vehicle normalization failed, using raw IS codes:', err);
      }
    }

    const result = await cotizarCC({
      nombre,
      apellido,
      edad: parseInt(edad),
      sexo: sexo || 'M',
      edocivil: edocivil || 'S',
      tppersona,
      tpodoc,
      prov: prov ? parseInt(prov) : null,
      letra,
      tomo: tomo ? parseInt(tomo) : null,
      asiento: asiento ? parseInt(asiento) : null,
      dv: dv ? parseInt(dv) : null,
      pasaporte,
      telefono: telefono || '2900000',
      celular: celular || '62900000',
      email: email || 'cotizacion@web.com',
      vehnuevo,
      codMarca: resolvedMarca,
      codModelo: resolvedModelo,
      anio: parseInt(anio),
      valorVeh: parseFloat(valorVeh),
      numPuestos: numPuestos ? parseInt(numPuestos) : 4,
      endoso: endoso || '1',
      lesiones,
      danios,
      gastosMedicos,
    });

    const elapsed = Date.now() - t0;
    console.log(`[REGIONAL CC Quote] Completado en ${elapsed}ms. Success: ${result.success}`);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message || 'Error al cotizar CC' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
      _timing: { totalMs: elapsed },
    });
  } catch (error: any) {
    console.error('[API REGIONAL CC Quote] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
