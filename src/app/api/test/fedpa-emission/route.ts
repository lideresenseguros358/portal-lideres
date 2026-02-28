/**
 * Test Route: FEDPA Emission End-to-End via EmisorPlan (2024)
 * GET /api/test/fedpa-emission?type=DT|CC|both&wait=N
 *
 * EmisorPlan es el ÚNICO path de emisión.
 * Emisor Externo (2021) ha sido eliminado del flujo de emisión.
 *
 * Flujo: generartoken → subirdocumentos → emitirpoliza
 * Nro Póliza formato: "04-05-NNNNN-0" (DT) / "04-07-NNNNN-0" (CC)
 *
 * DT Básico = $130 / DT Premium = $165 (Plan 426)
 * CC uses Plan 411
 *
 * &wait=N → retry token up to N attempts (30s intervals)
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerToken } from '@/lib/fedpa/auth.service';
import { subirDocumentos } from '@/lib/fedpa/documentos.service';
import { emitirPoliza } from '@/lib/fedpa/emision.service';
import type { EmitirPolizaRequest } from '@/lib/fedpa/types';

// Minimal valid JPEG (1x1 pixel)
function createTestJpeg(filename: string): File {
  const base64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS' +
    'Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ' +
    'CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
    'MjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEA' +
    'AAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh' +
    'MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6' +
    'Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZ' +
    'mqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx' +
    '8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREA' +
    'AgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAV' +
    'YnLRChYkNOEl8RcYI4Q/RFhHRUYnJCk0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNk' +
    'ZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6SlpqeoqaqysLGys7S1' +
    'tre4ubqCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwD' +
    'AQACEQMRAD8A/9k=';
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new File([bytes], filename, { type: 'image/jpeg' });
}

// DT Básico — Plan 426, Prima $130 (from auto-quotes.ts constants)
function buildDTPayload(idDoc: string): EmitirPolizaRequest {
  return {
    Plan: 426,
    idDoc,
    PrimerNombre: 'JUAN',
    PrimerApellido: 'PRUEBA',
    SegundoNombre: 'CARLOS',
    SegundoApellido: 'TEST',
    Identificacion: '8-888-1234',
    FechaNacimiento: '15/06/1990',
    Sexo: 'M',
    Email: 'test@lideresenseguros.com',
    Telefono: 2641234,
    Celular: 67891234,
    Direccion: 'PANAMA, CIUDAD DE PANAMA, CALLE 50',
    esPEP: 0,
    sumaAsegurada: 0,
    Uso: '10',
    Marca: 'TOY',
    Modelo: 'COROLLA',
    Ano: String(new Date().getFullYear()),
    Motor: 'TEST123456789',
    Placa: 'AB1234',
    Vin: 'JTDBR32E160123456',
    Color: 'BLANCO',
    Pasajero: 5,
    Puerta: 4,
    PrimaTotal: 130,
  };
}

// CC — Plan 411, Prima placeholder (will be set from cotización later)
function buildCCPayload(idDoc: string): EmitirPolizaRequest {
  return {
    Plan: 411,
    idDoc,
    PrimerNombre: 'MARIA',
    PrimerApellido: 'PRUEBA',
    SegundoNombre: 'ELENA',
    SegundoApellido: 'TEST',
    Identificacion: '3-745-2198',
    FechaNacimiento: '22/08/1985',
    Sexo: 'F',
    Email: 'test@lideresenseguros.com',
    Telefono: 2360987,
    Celular: 69457821,
    Direccion: 'PANAMA, VIA ESPANA, URBANIZACION LOS ANGELES',
    esPEP: 0,
    sumaAsegurada: 15000,
    Uso: '10',
    Marca: 'TOY',
    Modelo: 'COROLLA',
    Ano: String(new Date().getFullYear()),
    Motor: 'TEST987654321',
    Placa: 'CD5678',
    Vin: 'JTDBR32E160654321',
    Color: 'GRIS',
    Pasajero: 5,
    Puerta: 4,
    PrimaTotal: 500,
  };
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'DT';
  const waitAttempts = parseInt(request.nextUrl.searchParams.get('wait') || '0');
  const dtPlanOverride = parseInt(request.nextUrl.searchParams.get('dtPlan') || '0') || 0;
  const ccPlanOverride = parseInt(request.nextUrl.searchParams.get('ccPlan') || '0') || 0;
  const env = 'DEV' as const;
  const results: any = { timestamp: new Date().toISOString(), environment: env, steps: [] };

  try {
    // ══════════════════════════════════════════════
    // STEP 1: Get token (with optional retry loop)
    // ══════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════');
    console.log('[TEST FEDPA] STEP 1: Obtener token EmisorPlan');
    console.log('══════════════════════════════════════════════');

    let tokenResult = await obtenerToken(env);

    if (!tokenResult.success && waitAttempts > 0) {
      console.log(`[TEST FEDPA] Token bloqueado. Reintentando hasta ${waitAttempts} veces (30s intervalo)...`);
      for (let i = 1; i <= waitAttempts && !tokenResult.success; i++) {
        console.log(`[TEST FEDPA] Esperando 30s... (intento ${i}/${waitAttempts})`);
        await new Promise(r => setTimeout(r, 30_000));
        tokenResult = await obtenerToken(env);
      }
    }

    results.steps.push({
      step: 1, name: 'Token EmisorPlan',
      success: tokenResult.success,
      token: tokenResult.token ? `...${tokenResult.token.slice(-8)}` : null,
      error: tokenResult.error || null,
    });

    if (!tokenResult.success) {
      results.error = `Token no disponible: ${tokenResult.error}. Use &wait=N para reintentar.`;
      return NextResponse.json(results, { status: 424 });
    }
    console.log('[TEST FEDPA] ✅ Token obtenido');

    // ══════════════════════════════════════════════
    // STEP 2: Upload test documents
    // ══════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════');
    console.log('[TEST FEDPA] STEP 2: Subir documentos de prueba');
    console.log('══════════════════════════════════════════════');

    const testDocs = {
      documento_identidad: [createTestJpeg('documento_identidad.jpg')],
      licencia_conducir: [createTestJpeg('licencia_conducir.jpg')],
      registro_vehicular: [] as File[],
    };

    const uploadResult = await subirDocumentos(testDocs, env);
    results.steps.push({
      step: 2, name: 'Upload docs',
      success: uploadResult.success,
      idDoc: uploadResult.idDoc || null,
      error: uploadResult.error || null,
    });

    if (!uploadResult.success) {
      results.error = `Upload falló: ${uploadResult.error}`;
      return NextResponse.json(results, { status: 400 });
    }
    const idDoc = uploadResult.idDoc!;
    console.log('[TEST FEDPA] ✅ Docs subidos, idDoc:', idDoc);

    // ══════════════════════════════════════════════
    // STEP 3: Emit policies via EmisorPlan
    // ══════════════════════════════════════════════
    const runDT = type === 'DT' || type === 'both';
    const runCC = type === 'CC' || type === 'both';

    // ── DT Emission (Plan 426 — $130) ──
    if (runDT) {
      console.log('\n══════════════════════════════════════════════');
      console.log('[TEST FEDPA] STEP 3a: Emisión DT (Plan 426, $130)');
      console.log('══════════════════════════════════════════════');

      const dtPayload = buildDTPayload(idDoc);
      if (dtPlanOverride) dtPayload.Plan = dtPlanOverride;
      console.log('[TEST FEDPA] DT Payload:', JSON.stringify(dtPayload, null, 2));

      const dtResult = await emitirPoliza(dtPayload, env);
      results.steps.push({
        step: '3a', name: 'Emisión DT (Plan 426, $130)',
        success: dtResult.success,
        response: dtResult,
      });
      if (dtResult.success) {
        console.log(`[TEST FEDPA] ✅ DT EMITIDO — Póliza: ${dtResult.poliza}`);
        results.dtPoliza = dtResult.poliza;
      } else {
        console.error(`[TEST FEDPA] ❌ DT FALLÓ: ${dtResult.error}`);
      }
    }

    // ── CC Emission (Plan 411) ──
    if (runCC) {
      // Fresh docs for CC
      let ccIdDoc = idDoc;
      if (runDT) {
        const ccDocs = {
          documento_identidad: [createTestJpeg('documento_identidad.jpg')],
          licencia_conducir: [createTestJpeg('licencia_conducir.jpg')],
          registro_vehicular: [createTestJpeg('registro_vehicular.jpg')],
        };
        const ccUpload = await subirDocumentos(ccDocs, env);
        if (ccUpload.success && ccUpload.idDoc) ccIdDoc = ccUpload.idDoc;
      }

      console.log('\n══════════════════════════════════════════════');
      console.log('[TEST FEDPA] STEP 3b: Emisión CC (Plan 411)');
      console.log('══════════════════════════════════════════════');

      const ccPayload = buildCCPayload(ccIdDoc);
      if (ccPlanOverride) ccPayload.Plan = ccPlanOverride;
      console.log('[TEST FEDPA] CC Payload:', JSON.stringify(ccPayload, null, 2));

      const ccResult = await emitirPoliza(ccPayload, env);
      results.steps.push({
        step: '3b', name: 'Emisión CC (Plan 411)',
        success: ccResult.success,
        response: ccResult,
      });
      if (ccResult.success) {
        console.log(`[TEST FEDPA] ✅ CC EMITIDO — Póliza: ${ccResult.poliza}`);
        results.ccPoliza = ccResult.poliza;
      } else {
        console.error(`[TEST FEDPA] ❌ CC FALLÓ: ${ccResult.error}`);
      }
    }

    // ══════════════════════════════════════════════
    // SUMMARY
    // ══════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════');
    console.log('[TEST FEDPA] RESUMEN');
    console.log('══════════════════════════════════════════════');
    if (results.dtPoliza) console.log(`  DT Póliza: ${results.dtPoliza}`);
    if (results.ccPoliza) console.log(`  CC Póliza: ${results.ccPoliza}`);
    if (!results.dtPoliza && !results.ccPoliza) console.log('  ❌ Ninguna póliza emitida');
    console.log('══════════════════════════════════════════════\n');

    results.success = !!(results.dtPoliza || results.ccPoliza);
    return NextResponse.json(results);

  } catch (error: any) {
    console.error('[TEST FEDPA] Error no controlado:', error);
    results.error = error.message || 'Error no controlado';
    return NextResponse.json(results, { status: 500 });
  }
}
