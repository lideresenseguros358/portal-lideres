/**
 * API Endpoint: Emisión Póliza RC (Daños a Terceros) REGIONAL
 * POST /api/regional/auto/emit-rc
 *
 * Calls POST /regional/auto/emitirPolizaRc
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPolizaRC } from '@/lib/regional/emission.service';
import { colorToRegionalCode } from '@/lib/regional/color-map';
import { getRegionalCredentials } from '@/lib/regional/config';
import { resolveRegionalVehicleCodes } from '@/lib/cotizadores/regional-vehicle-mapper';
import type { RegionalRCEmissionBody } from '@/lib/regional/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  try {
    const body = await request.json();
    const creds = getRegionalCredentials('development');

    const {
      plan,
      // Cliente
      nombre, apellido, fechaNacimiento, edad, sexo, edocivil,
      telefono, celular, email,
      // Dirección
      codpais, codestado, codciudad, codmunicipio, codurb, dirhab,
      // Identificación
      tppersona, tpodoc, prov, letra, tomo, asiento, dv, pasaporte,
      // Vehículo
      codmarca, codmodelo, anio, numplaca, serialcarroceria, serialmotor, color,
      marca, modelo, // Brand/model names for IS→Regional normalization
      // Conductor habitual
      condHabNombre, condHabApellido, condHabSexo, condHabEdocivil,
    } = body;

    // Validations
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Falta el código del plan RC' },
        { status: 400 }
      );
    }
    if (!nombre || !apellido) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del cliente' },
        { status: 400 }
      );
    }
    if (!codmarca || !codmodelo || !anio) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del vehículo' },
        { status: 400 }
      );
    }

    // ═══ Normalize IS vehicle codes → Regional codes ═══
    // ALWAYS resolve via Regional catalog — NEVER send raw IS codes to Regional API
    let resolvedMarca: number;
    let resolvedModelo: number;

    if (!marca && !modelo) {
      return NextResponse.json(
        { success: false, error: 'Faltan nombres de marca/modelo del vehículo para resolver códigos Regional. Verifique los datos del vehículo.' },
        { status: 400 }
      );
    }

    try {
      const resolved = await resolveRegionalVehicleCodes({
        isMarcaCodigo: parseInt(codmarca),
        isModeloCodigo: parseInt(codmodelo),
        marcaNombre: marca || '',
        modeloNombre: modelo || '',
      });
      resolvedMarca = resolved.codMarca;
      resolvedModelo = resolved.codModelo;
      console.log(`[REGIONAL RC Emit] Vehicle codes normalized: marca ${codmarca}→${resolvedMarca}, modelo ${codmodelo}→${resolvedModelo} (${resolved.matchMethod})`);
    } catch (err: any) {
      console.error('[REGIONAL RC Emit] ❌ Vehicle code resolution FAILED:', err.message);
      return NextResponse.json(
        { success: false, error: `No se pudo resolver el vehículo en catálogo Regional: ${err.message}` },
        { status: 400 }
      );
    }

    // Convert color from free text to Regional catalog code
    const colorCode = colorToRegionalCode(color || '');

    // Sanitize phone numbers: digits only, min 7 chars
    const cleanPhone = (ph: string | undefined, fallback: string) => {
      const digits = (ph || '').replace(/\D/g, '');
      return digits.length >= 7 ? digits : fallback;
    };

    const emissionBody: RegionalRCEmissionBody = {
      codInter: creds.codInter,
      plan: String(plan),
      cliente: {
        nomter: (nombre || '').toUpperCase(),
        apeter: (apellido || '').toUpperCase(),
        fchnac: fechaNacimiento || '1990-01-01',
        edad: parseInt(edad) || 35,
        sexo: sexo || 'M',
        edocivil: edocivil || 'S',
        t1numero: cleanPhone(telefono, '2900000'),
        t2numero: cleanPhone(celular || telefono, '62900000'),
        email: email || '',
        direccion: {
          codpais: parseInt(codpais) || 507,
          codestado: parseInt(codestado) || 8,
          codciudad: parseInt(codciudad) || 1,
          codmunicipio: parseInt(codmunicipio) || 1,
          codurb: parseInt(codurb) || 1,
          dirhab: dirhab || 'Ciudad de Panamá',
        },
        identificacion: {
          tppersona: tppersona || 'N',
          tpodoc: tpodoc || 'C',
          prov: prov ? parseInt(prov) : null,
          letra: letra || null,
          tomo: tomo ? parseInt(tomo) : null,
          asiento: asiento ? parseInt(asiento) : null,
          dv: dv ? parseInt(dv) : null,
          pasaporte: pasaporte || null,
        },
      },
      datosveh: {
        codmarca: resolvedMarca,
        codmodelo: resolvedModelo,
        anio: parseInt(anio),
        numplaca: (numplaca || '').toUpperCase(),
        serialcarroceria: (serialcarroceria || '').toUpperCase(),
        serialmotor: (serialmotor || '').toUpperCase(),
        color: colorCode,
      },
      condHab: {
        nomter: (condHabNombre || nombre || '').toUpperCase(),
        apeter: (condHabApellido || apellido || '').toUpperCase(),
        sexo: condHabSexo || sexo || 'M',
        edocivil: condHabEdocivil || edocivil || 'S',
      },
    };

    console.log('[REGIONAL RC Emit] Emitting...', JSON.stringify(emissionBody).slice(0, 300));

    const result = await emitirPolizaRC(emissionBody);

    const elapsed = Date.now() - t0;
    console.log(`[REGIONAL RC Emit] Completed in ${elapsed}ms. Success: ${result.success}`);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message || 'Error emitiendo póliza RC' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...result,
      success: true,
      poliza: result.poliza,
      numcot: result.numcot,
      insurer: 'REGIONAL',
      // Echo back sent data for carátula verification
      cliente: {
        nombre: `${nombre} ${apellido}`.trim(),
        cedula: prov && tomo && asiento ? `${prov}-${tomo}-${asiento}` : (pasaporte || ''),
        email: email || '',
        telefono: celular || telefono || '',
        sexo: sexo || 'M',
        fechaNacimiento: fechaNacimiento || '',
      },
      vehiculo: {
        codmarca: parseInt(codmarca),
        codmodelo: parseInt(codmodelo),
        anio: parseInt(anio),
        placa: numplaca || '',
        serialcarroceria: serialcarroceria || '',
        serialmotor: serialmotor || '',
        color: colorCode,
      },
      plan: String(plan),
      _timing: { totalMs: elapsed },
    });
  } catch (error: any) {
    console.error('[API REGIONAL RC Emit] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
