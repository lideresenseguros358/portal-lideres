/**
 * API Endpoint: Emisión Póliza RC (Daños a Terceros) REGIONAL
 * POST /api/regional/auto/emit-rc
 *
 * Calls POST /regional/auto/emitirPolizaRc
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPolizaRC } from '@/lib/regional/emission.service';
import { getRegionalCredentials } from '@/lib/regional/config';
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

    const emissionBody: RegionalRCEmissionBody = {
      codInter: creds.codInter,
      plan: String(plan),
      cliente: {
        nomter: nombre,
        apeter: apellido,
        fchnac: fechaNacimiento || '1990-01-01',
        edad: parseInt(edad) || 35,
        sexo: sexo || 'M',
        edocivil: edocivil || 'S',
        t1numero: (telefono || '2900000').replace(/-/g, ''),
        t2numero: (celular || '62900000').replace(/-/g, ''),
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
        codmarca: parseInt(codmarca),
        codmodelo: parseInt(codmodelo),
        anio: parseInt(anio),
        numplaca: numplaca || '',
        serialcarroceria: serialcarroceria || '',
        serialmotor: serialmotor || '',
        color: color || '001',
      },
      condHab: {
        nomter: condHabNombre || nombre,
        apeter: condHabApellido || apellido,
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
