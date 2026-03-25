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

  // Helper: truncate and clean strings to prevent Oracle ORA-06502 buffer overflow
  const sanitize = (val: unknown, maxLen: number): string => {
    const s = String(val ?? '').trim();
    return s.length > maxLen ? s.substring(0, maxLen) : s;
  };

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
    const dirhab = sanitize(body.dirhab || body.direccion || 'Ciudad de Panamá', 100);
    // Datos cumplimiento
    const ocupacion = body.ocupacion || body.actividad;
    const ingresoAnual = body.ingresoAnual || body.nivelIngresos;
    const paisTributa = body.paisTributa;
    const pep = body.pep || body.esPEP;
    // Vehículo — accept frontend names: placa/motor/chasis/color
    // Oracle column limits: placa ~10, serial ~20, color ~5 (code)
    const vehnuevo = body.vehnuevo;
    const numplaca = sanitize(body.numplaca || body.placa, 10);
    const serialcarroceria = sanitize(body.serialcarroceria || body.chasis, 20);
    const serialmotor = sanitize(body.serialmotor || body.motor, 20);
    const rawColor = sanitize(body.color, 20);
    const usoveh = body.usoveh;
    const peso = body.peso;
    // Acreedor
    const acreedor = sanitize(body.acreedor || '81', 5);
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
    const creds = getRegionalCredentials();

    const emissionBody: RegionalCCEmissionBody = {
      numcot: parseInt(String(numcot)),
      cliente: {
        direccion: {
          codpais: parseInt(String(codpais)) || 507,
          codestado: parseInt(String(codestado)) || 8,
          codciudad: parseInt(String(codciudad)) || 1,
          codmunicipio: parseInt(String(codmunicipio)) || 1,
          codurb: parseInt(String(codurb)) || 1,
          dirhab: dirhab,
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
      acreedor: acreedor,
    };

    console.log(`[REGIONAL CC Emit] Field lengths: dirhab=${dirhab.length}, placa=${numplaca.length}, carroceria=${serialcarroceria.length}, motor=${serialmotor.length}, color=${colorCode.length}`);
    console.log('[REGIONAL CC Emit] Emitting...', JSON.stringify(emissionBody).slice(0, 500));

    // Retry logic for transient REGIONAL Oracle errors (ORA-03150 DB link, timeouts)
    const isTransientError = (msg: string) =>
      /ORA-03150|ORA-03113|ORA-03114|ORA-12170|ORA-02063|end-of-file|communication channel|timeout|ETIMEDOUT|ECONNRESET|socket hang up/i.test(msg);

    let lastResult: Awaited<ReturnType<typeof emitirPolizaCC>> | null = null;
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 3000;
        console.log(`[REGIONAL CC Emit] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
      lastResult = await emitirPolizaCC(emissionBody);
      if (lastResult.success || !isTransientError(lastResult.message || '')) break;
      console.warn(`[REGIONAL CC Emit] Transient error (attempt ${attempt + 1}): ${lastResult.message}`);
    }

    const emitResult = lastResult!;

    if (!emitResult.success) {
      const errMsg = emitResult.message || 'Error emitiendo póliza CC';
      const isServerDown = isTransientError(errMsg);
      return NextResponse.json(
        {
          success: false,
          error: isServerDown
            ? 'El servidor de La Regional no responde en este momento. Por favor intente nuevamente en unos minutos.'
            : errMsg,
          _rawError: errMsg,
          _retryable: isServerDown,
        },
        { status: isServerDown ? 503 : 500 }
      );
    }

    // 3. Build print URL — the frontend/confirmation page will call this to download the PDF
    const pdfUrl = emitResult.poliza ? `/api/regional/auto/print?poliza=${encodeURIComponent(emitResult.poliza)}` : null;

    const elapsed = Date.now() - t0;
    console.log(`[REGIONAL CC Emit] Completed in ${elapsed}ms. Poliza: ${emitResult.poliza}`);

    return NextResponse.json({
      success: true,
      poliza: emitResult.poliza,
      nroPoliza: emitResult.poliza,
      numcot: emitResult.numcot,
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
