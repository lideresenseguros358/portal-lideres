/**
 * API Endpoint: Emisión Póliza CC (Cobertura Completa) REGIONAL
 * POST /api/regional/auto/emit-cc
 *
 * Flow: emitirPoliza → (optional) planPago → imprimirPoliza
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPolizaCC, actualizarPlanPago } from '@/lib/regional/emission.service';
import { colorToRegionalCode } from '@/lib/regional/color-map';
import type { RegionalCCEmissionBody } from '@/lib/regional/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  try {
    const body = await request.json();

    // Accept both raw API field names AND the friendly names sent by the CC frontend
    const numcot = body.numcot;
    // Dirección — raw or defaults
    const codpais = body.codpais;
    const codestado = body.codestado || body.codProvincia;
    const codciudad = body.codciudad || body.codDistrito;
    const codmunicipio = body.codmunicipio || body.codCorregimiento;
    const codurb = body.codurb || body.codUrbanizacion;
    const dirhab = body.dirhab || body.direccion;
    // Datos cumplimiento
    const ocupacion = body.ocupacion || body.actividad;
    const ingresoAnual = body.ingresoAnual || body.nivelIngresos;
    const paisTributa = body.paisTributa;
    const pep = body.pep || body.esPEP;
    // Vehículo — accept frontend names: placa/motor/chasis/color
    const vehnuevo = body.vehnuevo;
    const numplaca = body.numplaca || body.placa || '';
    const serialcarroceria = body.serialcarroceria || body.chasis || '';
    const serialmotor = body.serialmotor || body.motor || '';
    const rawColor = body.color || '';
    const usoveh = body.usoveh;
    const peso = body.peso;
    // Acreedor
    const acreedor = body.acreedor;
    // Cuotas
    const cuotas = body.cuotas || body.cantCuotas;
    const opcionPrima = body.opcionPrima;

    if (!numcot) {
      return NextResponse.json(
        { success: false, error: 'Falta numcot (número de cotización)' },
        { status: 400 }
      );
    }

    // Convert color from free text to Regional catalog code
    const colorCode = colorToRegionalCode(rawColor);

    // 1. Update plan de pago if cuotas > 1
    const cuotasNum = cuotas ? parseInt(String(cuotas)) : 1;
    if (cuotasNum > 1) {
      console.log(`[REGIONAL CC Emit] Updating plan pago: numcot=${numcot}, cuotas=${cuotasNum}`);
      const pagoResult = await actualizarPlanPago({
        numcot: parseInt(String(numcot)),
        cuotas: cuotasNum,
        opcionPrima: parseInt(String(opcionPrima)) || 1,
      });
      if (!pagoResult.success) {
        console.warn('[REGIONAL CC Emit] Plan pago failed:', pagoResult.message);
        // Don't fail entirely — continue with emission
      }
    }

    // 2. Emit policy
    const { getRegionalCredentials } = await import('@/lib/regional/config');
    const creds = getRegionalCredentials('development');

    const emissionBody: RegionalCCEmissionBody = {
      codInter: creds.codInter,
      numcot: parseInt(String(numcot)),
      cliente: {
        direccion: {
          codpais: parseInt(String(codpais)) || 507,
          codestado: parseInt(String(codestado)) || 8,
          codciudad: parseInt(String(codciudad)) || 1,
          codmunicipio: parseInt(String(codmunicipio)) || 1,
          codurb: parseInt(String(codurb)) || 1,
          dirhab: dirhab || 'Ciudad de Panamá',
        },
        datosCumplimiento: {
          ocupacion: parseInt(String(ocupacion)) || 1,
          ingresoAnual: parseInt(String(ingresoAnual)) || 1,
          paisTributa: parseInt(String(paisTributa)) || 507,
          pep: (pep === true || pep === 'S') ? 'S' : 'N',
        },
      },
      datosveh: {
        vehnuevo: vehnuevo || 'N',
        numplaca: String(numplaca).toUpperCase(),
        serialcarroceria: String(serialcarroceria).toUpperCase(),
        serialmotor: String(serialmotor).toUpperCase(),
        color: colorCode,
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

    // 3. Build print URL — the frontend/confirmation page will call this to download the PDF
    const pdfUrl = result.poliza ? `/api/regional/auto/print?poliza=${encodeURIComponent(result.poliza)}` : null;

    const elapsed = Date.now() - t0;
    console.log(`[REGIONAL CC Emit] Completed in ${elapsed}ms. Poliza: ${result.poliza}`);

    return NextResponse.json({
      success: true,
      poliza: result.poliza,
      nroPoliza: result.poliza,
      numcot: result.numcot,
      pdfUrl,
      insurer: 'REGIONAL',
      // Echo back sent data for carátula verification
      vehiculo: {
        placa: numplaca || '',
        serialcarroceria: serialcarroceria || '',
        serialmotor: serialmotor || '',
        color: colorCode,
      },
      cuotasSent: cuotasNum,
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
