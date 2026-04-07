/**
 * smoke-ancon-dt.ts
 * ═══════════════════════════════════════════════════════════
 * Full ANCON DT emission smoke test against PROD.
 *
 * Emulates EXACTLY what the portal does:
 *   Step 1 — GET /api/ancon/third-party  → obtener noCotizacion real
 *   Step 2 — POST /api/ancon/emision     → emitir póliza DT (FormData con documentos)
 *   Step 3 — POST /api/is/auto/send-expediente → enviar expediente + bienvenida
 *   Step 4 — GET  /api/ancon/print?poliza=XXX  → intentar descargar carátula
 *
 * Contratante = Asegurado (como siempre en el portal).
 *
 * Run:
 *   npx ts-node --project tsconfig.json scripts/smoke-ancon-dt.ts
 *   npx tsx scripts/smoke-ancon-dt.ts
 *
 * Env required:
 *   PROD_BASE_URL=https://portal.lideresenseguros.com
 *   CRON_SECRET or ADM_COT_CRON_SECRET (solo si se usa el endpoint protegido)
 * ═══════════════════════════════════════════════════════════
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// ── Config ──────────────────────────────────────────────────
const BASE_URL = process.env.PROD_BASE_URL?.replace(/\/$/, '') ?? 'https://portal.lideresenseguros.com';

// ── Test client (contratante = asegurado) ───────────────────
const TEST_CLIENT = {
  primerNombre:    'SMOKE',
  segundoNombre:   'TEST',
  primerApellido:  'PRUEBA',
  segundoApellido: 'ANCON',
  cedula:          '8-123-4567',
  email:           'contacto@lideresenseguros.com',  // results go to office
  telefono:        '6000-0000',
  celular:         '6000-0000',
  direccion:       'CIUDAD DE PANAMA',
  fechaNacimiento: '15/06/1985',
  sexo:            'M',
  estadoCivil:     'SOLTERO',
  nacionalidad:    'PANAMEÑA',
  esPEP:           false,
  actividadEconomica: 'EMPLEADO',
  dondeTrabaja:    'EMPRESA PRIVADA',
  nivelIngresos:   'De $10,000 a $30,000',
};

// ── Test vehicle ─────────────────────────────────────────────
const TEST_VEHICLE = {
  placa:          'XX-0000',
  vinChasis:      'SMOKE123TEST456789',
  motor:          'SMOKE-MOTOR-001',
  color:          'BLANCO',
  pasajeros:      '5',
  puertas:        '4',
  tipoTransmision:'AUTOMATICO',
  marca:          'TOYOTA',
  modelo:         'COROLLA',
  anio:           String(new Date().getFullYear()),
  // ANCON catalog codes for TOYOTA COROLLA
  vcodmarca:      '00122',
  vcodmodelo:     '10393',
};

// ── Minimal valid 1×1 white PNG (for cédula/licencia stub files) ─
const MINIMAL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';
const MINIMAL_PNG_BUFFER = Buffer.from(MINIMAL_PNG_BASE64, 'base64');
const MINIMAL_PNG_FILENAME = 'documento_cedula.png';

// ── Minimal valid 1×1 white PNG for firma ────────────────────
const FIRMA_DATA_URL = `data:image/png;base64,${MINIMAL_PNG_BASE64}`;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function log(step: string, msg: string, data?: unknown) {
  const ts = new Date().toISOString().slice(11, 23);
  const dataStr = data !== undefined ? `\n    ${JSON.stringify(data).substring(0, 400)}` : '';
  console.log(`[${ts}] [${step}] ${msg}${dataStr}`);
}

function sep(title: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

async function fetchJson(url: string, opts?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, opts);
  let body: unknown;
  const ct = res.headers.get('content-type') || '';
  try {
    body = ct.includes('application/json') ? await res.json() : await res.text();
  } catch {
    body = `(parse error) status=${res.status}`;
  }
  return { status: res.status, body };
}

// Build FormData-compatible entry as Buffer for Node.js fetch (which is undici-based in Node 18+)
// We use the native FormData from Node 18.
function makeFile(buffer: Buffer, filename: string, mimeType: string): File {
  return new File([buffer], filename, { type: mimeType });
}

// ────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────

async function main() {
  sep('ANCON DT SMOKE TEST — PROD');
  log('CONFIG', `Target: ${BASE_URL}`);

  const results: Record<string, unknown> = {};

  // ════════════════════════════════════════════════════════
  // STEP 1: GET /api/ancon/third-party — obtener noCotizacion
  // ════════════════════════════════════════════════════════
  sep('STEP 1 — GET /api/ancon/third-party (cotización SOBAT)');

  const step1 = await fetchJson(`${BASE_URL}/api/ancon/third-party`);
  log('1', `HTTP ${step1.status}`, step1.body);

  const plans = (step1.body as any)?.plans ?? [];
  const noCotizacion: string = (step1.body as any)?.noCotizacion || plans?.[0]?.noCotizacion || '';
  const basicPlan = plans.find((p: any) => p.planType === 'basic') ?? plans[0] ?? {};

  results.step1 = {
    ok: step1.status === 200 && !!noCotizacion,
    noCotizacion,
    online: (step1.body as any)?.online,
    plansCount: plans.length,
  };

  if (!noCotizacion) {
    log('1', '⚠️  No noCotizacion returned. ANCON API may be offline. Will attempt emission with placeholder.');
  } else {
    log('1', `✅  noCotizacion: ${noCotizacion}`);
  }

  // ════════════════════════════════════════════════════════
  // STEP 2: POST /api/ancon/emision — emitir póliza DT
  // ════════════════════════════════════════════════════════
  sep('STEP 2 — POST /api/ancon/emision (emitir DT)');

  const emitBody: Record<string, string> = {
    no_cotizacion:       noCotizacion || '99999',
    opcion:              'A',
    cod_producto:        basicPlan._codProducto  || '07159',
    nombre_producto:     basicPlan._nombreProducto || 'WEB - AUTORC',
    suma_asegurada:      basicPlan._sumaAsegurada  ?? '0',

    // Client — contratante = asegurado (same person)
    primer_nombre:       TEST_CLIENT.primerNombre,
    segundo_nombre:      TEST_CLIENT.segundoNombre,
    primer_apellido:     TEST_CLIENT.primerApellido,
    segundo_apellido:    TEST_CLIENT.segundoApellido,
    apellido_casada:     '',
    tipo_de_cliente:     'N',
    cedula:              TEST_CLIENT.cedula,
    pasaporte:           '',
    ruc:                 '',
    fecha_nacimiento:    TEST_CLIENT.fechaNacimiento,
    sexo:                TEST_CLIENT.sexo,
    telefono_celular:    TEST_CLIENT.celular,
    telefono_residencial:TEST_CLIENT.telefono,
    telefono_oficina:    '',
    email:               TEST_CLIENT.email,
    direccion:           TEST_CLIENT.direccion,
    direccion_cobros:    TEST_CLIENT.direccion,
    nacionalidad:        TEST_CLIENT.nacionalidad,
    pep:                 '0',
    estado_civil:        TEST_CLIENT.estadoCivil,
    ocupacion:           '001',
    profesion:           '1',
    empresa:             TEST_CLIENT.dondeTrabaja,
    nivel_ingreso:       TEST_CLIENT.nivelIngresos,
    pais_residencia:     'PANAMÁ',
    actividad_economica: '001',
    representante_legal: '',
    nombre_comercial:    '',
    aviso_operacion:     '',

    // Vehicle
    cod_marca_agt:       TEST_VEHICLE.vcodmarca,
    nombre_marca:        TEST_VEHICLE.marca,
    cod_modelo_agt:      TEST_VEHICLE.vcodmodelo,
    nombre_modelo:       TEST_VEHICLE.modelo,
    uso:                 'PARTICULAR',
    codigo_color_agt:    '001',
    nombre_color_agt:    TEST_VEHICLE.color,
    no_chasis:           TEST_VEHICLE.vinChasis,
    vin:                 TEST_VEHICLE.vinChasis,
    no_motor:            TEST_VEHICLE.motor,
    placa:               TEST_VEHICLE.placa,
    puertas:             TEST_VEHICLE.puertas,
    pasajeros:           TEST_VEHICLE.pasajeros,
    cilindros:           '4',
    ano:                 TEST_VEHICLE.anio,
    nombre_conductor:    TEST_CLIENT.primerNombre,
    apellido_conductor:  TEST_CLIENT.primerApellido,
    sexo_conductor:      TEST_CLIENT.sexo,

    // Payment
    cantidad_de_pago:    '1',
    descuento:           '0',
    codigo_acreedor:     '',
    nombre_acreedor:     '',
    cod_grupo:           '00001',
    nombre_grupo:        'SIN GRUPO',
  };

  const emitForm = new FormData();
  emitForm.append('emissionData', JSON.stringify(emitBody));
  emitForm.append('firmaDataUrl', FIRMA_DATA_URL);
  // Stub document files (minimal PNG)
  emitForm.append('cedulaFile',   makeFile(MINIMAL_PNG_BUFFER, MINIMAL_PNG_FILENAME,    'image/png'));
  emitForm.append('licenciaFile', makeFile(MINIMAL_PNG_BUFFER, 'licencia_conducir.png', 'image/png'));
  emitForm.append('registroVehicularFile', makeFile(MINIMAL_PNG_BUFFER, 'registro_vehicular.png', 'image/png'));

  log('2', 'Calling /api/ancon/emision ...');
  const step2 = await fetchJson(`${BASE_URL}/api/ancon/emision`, {
    method: 'POST',
    body: emitForm,
  });
  log('2', `HTTP ${step2.status}`, step2.body);

  const poliza: string      = (step2.body as any)?.poliza || (step2.body as any)?.nroPoliza || '';
  const pdfUrlFromEmit: string = (step2.body as any)?.pdfUrl || '';
  const emitSuccess: boolean = step2.status === 200 && !!(step2.body as any)?.success;

  results.step2 = {
    ok:       emitSuccess,
    poliza,
    pdfUrl:   pdfUrlFromEmit,
    error:    (step2.body as any)?.error ?? null,
    httpStatus: step2.status,
  };

  if (!emitSuccess || !poliza) {
    log('2', `❌ Emisión fallida. Abortando pasos 3 y 4.`);
    printSummary(results, '', false);
    return;
  }
  log('2', `✅ Póliza emitida: ${poliza}`);

  // ════════════════════════════════════════════════════════
  // STEP 3: POST /api/is/auto/send-expediente — expediente + bienvenida
  // ════════════════════════════════════════════════════════
  sep('STEP 3 — POST /api/is/auto/send-expediente (expediente + bienvenida)');

  const expedienteForm = new FormData();
  expedienteForm.append('tipoCobertura',  'DT');
  expedienteForm.append('environment',    'development');
  expedienteForm.append('nroPoliza',      poliza);
  expedienteForm.append('pdfUrl',         pdfUrlFromEmit || '');
  expedienteForm.append('insurerName',    'ANCÓN Seguros');
  expedienteForm.append('firmaDataUrl',   FIRMA_DATA_URL);

  expedienteForm.append('clientData', JSON.stringify({
    primerNombre:      TEST_CLIENT.primerNombre,
    segundoNombre:     TEST_CLIENT.segundoNombre,
    primerApellido:    TEST_CLIENT.primerApellido,
    segundoApellido:   TEST_CLIENT.segundoApellido,
    cedula:            TEST_CLIENT.cedula,
    email:             TEST_CLIENT.email,
    telefono:          TEST_CLIENT.telefono,
    celular:           TEST_CLIENT.celular,
    direccion:         TEST_CLIENT.direccion,
    fechaNacimiento:   TEST_CLIENT.fechaNacimiento,
    sexo:              TEST_CLIENT.sexo,
    estadoCivil:       TEST_CLIENT.estadoCivil,
    nacionalidad:      TEST_CLIENT.nacionalidad,
    esPEP:             TEST_CLIENT.esPEP,
    actividadEconomica:TEST_CLIENT.actividadEconomica,
    dondeTrabaja:      TEST_CLIENT.dondeTrabaja,
    nivelIngresos:     TEST_CLIENT.nivelIngresos,
  }));

  expedienteForm.append('vehicleData', JSON.stringify({
    placa:          TEST_VEHICLE.placa,
    vinChasis:      TEST_VEHICLE.vinChasis,
    motor:          TEST_VEHICLE.motor,
    color:          TEST_VEHICLE.color,
    pasajeros:      TEST_VEHICLE.pasajeros,
    puertas:        TEST_VEHICLE.puertas,
    tipoTransmision:TEST_VEHICLE.tipoTransmision,
    marca:          TEST_VEHICLE.marca,
    modelo:         TEST_VEHICLE.modelo,
    anio:           TEST_VEHICLE.anio,
  }));

  expedienteForm.append('quoteData', JSON.stringify({
    marca:         TEST_VEHICLE.marca,
    modelo:        TEST_VEHICLE.modelo,
    anio:          TEST_VEHICLE.anio,
    cobertura:     'Daños a Terceros',
    primaTotal:    basicPlan.annualPremium || 145,
    primaContado:  basicPlan.annualPremium || 145,
    formaPago:     'contado',
    cantidadCuotas:1,
  }));

  expedienteForm.append('cedulaFile',             makeFile(MINIMAL_PNG_BUFFER, MINIMAL_PNG_FILENAME,    'image/png'));
  expedienteForm.append('licenciaFile',           makeFile(MINIMAL_PNG_BUFFER, 'licencia_conducir.png', 'image/png'));
  expedienteForm.append('registroVehicularFile',  makeFile(MINIMAL_PNG_BUFFER, 'registro_vehicular.png','image/png'));

  log('3', 'Calling /api/is/auto/send-expediente ...');
  const step3 = await fetchJson(`${BASE_URL}/api/is/auto/send-expediente`, {
    method: 'POST',
    body: expedienteForm,
  });
  log('3', `HTTP ${step3.status}`, step3.body);

  results.step3 = {
    ok:               step3.status === 200 && !!(step3.body as any)?.success,
    messageId:        (step3.body as any)?.messageId ?? null,
    clientEmailSent:  (step3.body as any)?.clientEmailSent ?? null,
    expediente:       (step3.body as any)?.expediente ?? null,
    error:            (step3.body as any)?.error ?? null,
    httpStatus:       step3.status,
  };

  if ((results.step3 as any).ok) {
    log('3', `✅ Expediente enviado. messageId=${(results.step3 as any).messageId}`);
  } else {
    log('3', `⚠️  Expediente con error (no bloquea).`);
  }

  // ════════════════════════════════════════════════════════
  // STEP 4: GET /api/ancon/print?poliza=XXX — carátula PDF
  // ════════════════════════════════════════════════════════
  sep('STEP 4 — GET /api/ancon/print (carátula PDF)');

  const printUrl = `${BASE_URL}/api/ancon/print?poliza=${encodeURIComponent(poliza)}`;
  log('4', `Calling ${printUrl}`);

  let caratulaOk = false;
  let caratulaUrl = '';
  let caratulaNote = '';

  try {
    const printRes = await fetch(printUrl);
    const printCt = printRes.headers.get('content-type') || '';
    log('4', `HTTP ${printRes.status} | Content-Type: ${printCt}`);

    if (printRes.status === 200 && printCt.includes('application/pdf')) {
      const pdfBuf = Buffer.from(await printRes.arrayBuffer());
      const outPath = path.join(__dirname, `caratula_smoke_${poliza.replace(/\//g, '-')}.pdf`);
      fs.writeFileSync(outPath, pdfBuf);
      caratulaOk  = true;
      caratulaUrl = outPath;
      caratulaNote = `PDF descargado (${pdfBuf.length} bytes) → ${outPath}`;
      log('4', `✅ Carátula PDF descargada: ${outPath} (${pdfBuf.length} bytes)`);
    } else {
      const printBody = printCt.includes('application/json')
        ? await printRes.json()
        : await printRes.text();
      log('4', `PDF no disponible (${printRes.status})`, printBody);

      // If pdfUrl was returned directly by emission step, try it as well
      if (pdfUrlFromEmit && pdfUrlFromEmit.startsWith('http') && pdfUrlFromEmit !== printUrl) {
        log('4', `Trying pdfUrl returned by emision step: ${pdfUrlFromEmit.substring(0, 80)}...`);
        const pdfRes2 = await fetch(pdfUrlFromEmit);
        const ct2 = pdfRes2.headers.get('content-type') || '';
        if (pdfRes2.status === 200 && ct2.includes('application/pdf')) {
          const pdfBuf2 = Buffer.from(await pdfRes2.arrayBuffer());
          const outPath2 = path.join(__dirname, `caratula_smoke_direct_${poliza.replace(/\//g, '-')}.pdf`);
          fs.writeFileSync(outPath2, pdfBuf2);
          caratulaOk  = true;
          caratulaUrl = outPath2;
          caratulaNote = `PDF descargado via pdfUrl directo (${pdfBuf2.length} bytes) → ${outPath2}`;
          log('4', `✅ Carátula descargada via pdfUrl directo: ${outPath2}`);
        } else {
          caratulaNote = `pdfUrl directo también falló (${pdfRes2.status}). Carátula pendiente en ANCON.`;
          log('4', `⚠️  pdfUrl directo: HTTP ${pdfRes2.status}`);
        }
      } else {
        caratulaNote = typeof printBody === 'object'
          ? `Error: ${(printBody as any)?.error || JSON.stringify(printBody).substring(0, 150)}`
          : String(printBody).substring(0, 200);
      }
    }
  } catch (err: any) {
    caratulaNote = `Excepción: ${err.message}`;
    log('4', `❌ Excepción al obtener carátula: ${err.message}`);
  }

  results.step4 = {
    ok:          caratulaOk,
    caratulaUrl: caratulaOk ? caratulaUrl : null,
    printUrl,
    note:        caratulaNote,
  };

  printSummary(results, poliza, caratulaOk);
}

// ────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────

function printSummary(results: Record<string, unknown>, poliza: string, caratulaOk: boolean) {
  sep('RESUMEN SMOKE TEST ANCON DT');

  const r1 = results.step1 as any;
  const r2 = results.step2 as any;
  const r3 = results.step3 as any;
  const r4 = results.step4 as any;

  const icon = (ok: boolean | undefined) => ok ? '✅' : '❌';

  console.log(`
  ${icon(r1?.ok)}  STEP 1 — Cotización SOBAT
       noCotizacion : ${r1?.noCotizacion || 'N/A'}
       ANCON online : ${r1?.online}
       Planes       : ${r1?.plansCount}

  ${icon(r2?.ok)}  STEP 2 — Emisión póliza DT
       Póliza       : ${poliza || 'N/A'}
       pdfUrl       : ${r2?.pdfUrl || 'N/A'}
       Error        : ${r2?.error || '—'}

  ${icon(r3?.ok)}  STEP 3 — Expediente + Bienvenida
       messageId    : ${r3?.messageId || 'N/A'}
       clientEmail  : ${r3?.clientEmailSent}
       expedienteDocs: ${JSON.stringify(r3?.expediente?.saved ?? [])}
       Error        : ${r3?.error || '—'}

  ${icon(r4?.ok)}  STEP 4 — Carátula PDF
       Resultado    : ${r4?.note || 'N/A'}
       PDF local    : ${r4?.caratulaUrl || 'No descargado'}

  ────────────────────────────────────────────────────────
  NÚMERO DE PÓLIZA EMITIDA : ${poliza || 'NO EMITIDA'}
  CARÁTULA DESCARGADA      : ${caratulaOk ? 'SÍ ✅' : 'NO ❌ (pendiente en ANCON)'}
  ────────────────────────────────────────────────────────
`);
}

main().catch(err => {
  console.error('\n[SMOKE TEST] Fatal error:', err);
  process.exit(1);
});
