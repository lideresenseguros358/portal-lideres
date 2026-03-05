/**
 * API Endpoint: Emisión Póliza CC (Cobertura Completa) REGIONAL
 * POST /api/regional/auto/emit-cc
 *
 * Flow: emitirPoliza → (optional) planPago → imprimirPoliza
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPolizaCC, actualizarPlanPago, imprimirPoliza } from '@/lib/regional/emission.service';
import type { RegionalCCEmissionBody } from '@/lib/regional/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  try {
    const body = await request.json();

    const {
      numcot,
      // Dirección
      codpais, codestado, codciudad, codmunicipio, codurb, dirhab,
      // Datos cumplimiento
      ocupacion, ingresoAnual, paisTributa, pep,
      // Vehículo
      vehnuevo, numplaca, serialcarroceria, serialmotor, color, usoveh, peso,
      // Acreedor
      acreedor,
      // Cuotas (optional)
      cuotas, opcionPrima,
    } = body;

    if (!numcot) {
      return NextResponse.json(
        { success: false, error: 'Falta numcot (número de cotización)' },
        { status: 400 }
      );
    }

    // 1. Update plan de pago if cuotas > 1
    if (cuotas && parseInt(cuotas) > 1) {
      console.log(`[REGIONAL CC Emit] Updating plan pago: numcot=${numcot}, cuotas=${cuotas}`);
      const pagoResult = await actualizarPlanPago({
        numcot: parseInt(numcot),
        cuotas: parseInt(cuotas),
        opcionPrima: parseInt(opcionPrima) || 1,
      });
      if (!pagoResult.success) {
        console.warn('[REGIONAL CC Emit] Plan pago failed:', pagoResult.message);
        // Don't fail entirely — continue with emission
      }
    }

    // 2. Emit policy
    const emissionBody: RegionalCCEmissionBody = {
      numcot: parseInt(numcot),
      cliente: {
        direccion: {
          codpais: parseInt(codpais) || 507,
          codestado: parseInt(codestado) || 8,
          codciudad: parseInt(codciudad) || 1,
          codmunicipio: parseInt(codmunicipio) || 1,
          codurb: parseInt(codurb) || 1,
          dirhab: dirhab || 'Ciudad de Panamá',
        },
        datosCumplimiento: {
          ocupacion: parseInt(ocupacion) || 1,
          ingresoAnual: parseInt(ingresoAnual) || 1,
          paisTributa: parseInt(paisTributa) || 507,
          pep: pep || 'N',
        },
      },
      datosveh: {
        vehnuevo: vehnuevo || 'N',
        numplaca: numplaca || '',
        serialcarroceria: serialcarroceria || '',
        serialmotor: serialmotor || '',
        color: color || '093',
        usoveh: usoveh || 'P',
        peso: peso || 'L',
      },
      acreedor: acreedor || '81',
    };

    console.log('[REGIONAL CC Emit] Emitting...', JSON.stringify(emissionBody).slice(0, 300));

    const result = await emitirPolizaCC(emissionBody);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message || 'Error emitiendo póliza CC' },
        { status: 500 }
      );
    }

    // 3. Print policy PDF if poliza number is available
    let pdfUrl: string | null = null;
    if (result.poliza) {
      console.log(`[REGIONAL CC Emit] Printing policy: ${result.poliza}`);
      const printResult = await imprimirPoliza(result.poliza);
      if (printResult.success && printResult.pdf) {
        pdfUrl = printResult.pdf;
      } else {
        console.warn('[REGIONAL CC Emit] Print failed:', printResult.message);
      }
    }

    const elapsed = Date.now() - t0;
    console.log(`[REGIONAL CC Emit] Completed in ${elapsed}ms. Poliza: ${result.poliza}`);

    return NextResponse.json({
      success: true,
      poliza: result.poliza,
      numcot: result.numcot,
      pdfUrl,
      insurer: 'REGIONAL',
      _timing: { totalMs: elapsed },
    });
  } catch (error: any) {
    console.error('[API REGIONAL CC Emit] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
