/**
 * ANCON DT — Captura exacta del payload EmitirDatos
 * ═══════════════════════════════════════════════════
 * Corre 2 pruebas completas de emisión DT y vuelca:
 *   • El XML SOAP exacto enviado a EmitirDatos
 *   • Los parámetros como JSON estructurado
 *   • La respuesta raw de ANCON
 *
 * Uso:
 *   node scripts/test/test-ancon-dt-emitirdatos-payload.mjs
 */

import * as fs from 'fs';

const SOAP_URL   = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO    = '01009';
const PASSWORD   = '750840840940840';
const COD_AGENTE = '01009';
const COD_COMPANIA = '001';
const COD_SUCURSAL  = '009';

// ── Dos conjuntos de datos de prueba distintos ─────────────────
const TEST_CASES = [
  {
    label: 'PRUEBA #1 — Cliente Juan Pérez',
    cedula:         '8-888-9999',
    primer_nombre:  'JUAN',
    segundo_nombre: '',
    primer_apellido:'PEREZ',
    segundo_apellido:'',
    fecha_nacimiento:'16/06/1994',
    sexo:           'M',
    telefono_celular:'6000-0001',
    email:          'test1@test.com',
    direccion:      'PANAMA',
    placa:          'TST001',
    no_chasis:      'ANCONDT_TEST1_2026',
    no_motor:       'MOTOR_TEST1_2026',
    cod_marca:      '00122',
    nombre_marca:   'TOYOTA',
    cod_modelo:     '10393',
    nombre_modelo:  'COROLLA',
    ano:            '2025',
  },
  {
    label: 'PRUEBA #2 — Cliente María López',
    cedula:         '4-123-4567',
    primer_nombre:  'MARIA',
    segundo_nombre: 'DE',
    primer_apellido:'LOPEZ',
    segundo_apellido:'GARCIA',
    fecha_nacimiento:'22/03/1988',
    sexo:           'F',
    telefono_celular:'6000-0002',
    email:          'test2@test.com',
    direccion:      'PANAMA',
    placa:          'TST002',
    no_chasis:      'ANCONDT_TEST2_2026',
    no_motor:       'MOTOR_TEST2_2026',
    cod_marca:      '00122',
    nombre_marca:   'TOYOTA',
    cod_modelo:     '10393',
    nombre_modelo:  'COROLLA',
    ano:            '2024',
  },
];

// ── SOAP helpers ────────────────────────────────────────────────
function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEnvelope(method, params) {
  const xml = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<${k}>${escXml(String(v))}</${k}>`)
    .join('\n    ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros">
  <soap:Body>
    <tns:${method}>
    ${xml}
    </tns:${method}>
  </soap:Body>
</soap:Envelope>`;
}

function decodeEntities(t) {
  return t
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&apos;/g, "'")
    .replace(/&ntilde;/g, 'ñ').replace(/&oacute;/g, 'ó');
}

async function soap(label, method, params) {
  const envelope = buildEnvelope(method, params);
  const t0 = Date.now();
  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `urn:server_otros#${method}`,
    },
    body: envelope,
  });
  const rawText = await res.text();
  const elapsed = Date.now() - t0;

  const m = rawText.match(/<data[^>]*>([\s\S]*?)<\/data>/) ||
            rawText.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) {
    const d = decodeEntities(m[1]);
    try { parsed = JSON.parse(d); } catch { parsed = d; }
  } else {
    parsed = rawText.substring(0, 1000);
  }

  console.log(`  ► [${label}] ${method} (${elapsed}ms)`);
  return { parsed, envelope, rawText, elapsed };
}

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function sep(title) {
  const line = '═'.repeat(70);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(line);
}

// ── Main ───────────────────────────────────────────────────────
async function runTest(tc, index) {
  sep(`${tc.label}`);

  const results = { label: tc.label };

  // 1. Login
  console.log('\n[1/4] GenerarToken...');
  const loginRes = await soap('LOGIN', 'GenerarToken', {
    par_usuario: USUARIO,
    par_password: PASSWORD,
  });
  const token = loginRes.parsed?.Login?.[0]?.Token;
  if (!token) {
    console.error('  ✗ Login fallido. Respuesta:', JSON.stringify(loginRes.parsed).substring(0, 300));
    return;
  }
  console.log(`  ✓ Token: ${token.substring(0, 24)}...`);

  // 2. Cotización DT
  console.log('\n[2/4] Estandar (DT cod_producto=07159)...');
  const cotRes = await soap('COT', 'Estandar', {
    token,
    cod_marca:      tc.cod_marca,
    cod_modelo:     tc.cod_modelo,
    ano:            tc.ano,
    suma_asegurada: '0',
    cod_producto:   '07159',
    cedula:         tc.cedula,
    nombre:         tc.primer_nombre,
    apellido:       tc.primer_apellido,
    vigencia:       'A',
    email:          tc.email,
    tipo_persona:   'N',
    fecha_nac:      tc.fecha_nacimiento,
    nuevo:          '0',
    responsable:    'CORREDOR',
  });

  let noCotizacion = null;
  const cot = cotRes.parsed;
  if (cot?.cotizacion) {
    for (const items of Object.values(cot.cotizacion)) {
      if (Array.isArray(items)) {
        const nc = items.find(i => i.Cobertura === 'NoCotizacion');
        if (nc) { noCotizacion = nc.Descripcion1; break; }
      }
    }
  }
  if (!noCotizacion) {
    console.error('  ✗ NoCotizacion no obtenido. Respuesta:', JSON.stringify(cot).substring(0, 400));
    return;
  }
  console.log(`  ✓ NoCotizacion: ${noCotizacion}`);
  results.noCotizacion = noCotizacion;

  // 3. GenerarNodocumento (ramo 002 = DT/RC)
  console.log('\n[3/4] GenerarNodocumento (ramo 002)...');
  const currentYear = new Date().getFullYear().toString();
  const genToken = token; // reusar token
  const genRes = await soap('GEN', 'GenerarNodocumento', {
    cod_compania: COD_COMPANIA,
    cod_sucursal:  COD_SUCURSAL,
    ano:           currentYear,
    cod_ramo:      '002',
    cod_subramo:   '001',
    token:         genToken,
  });
  const poliza = Array.isArray(genRes.parsed)
    ? genRes.parsed[0]?.no_documento
    : genRes.parsed?.no_documento;
  if (!poliza) {
    console.error('  ✗ Póliza no generada. Respuesta:', JSON.stringify(genRes.parsed).substring(0, 300));
    return;
  }
  console.log(`  ✓ Póliza: ${poliza}`);
  results.poliza = poliza;

  // 4. EmitirDatos — CAPTURAR PAYLOAD EXACTO
  console.log('\n[4/4] EmitirDatos — construyendo payload...');
  const today    = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  const emitToken = token; // mismo token (no caducado)

  const emitParams = {
    poliza,
    ramo_agt:             'AUTOMOVIL',
    vigencia_inicial:     fmtDate(today),
    vigencia_final:       fmtDate(nextYear),
    primer_nombre:        tc.primer_nombre,
    segundo_nombre:       tc.segundo_nombre,
    primer_apellido:      tc.primer_apellido,
    segundo_apellido:     tc.segundo_apellido,
    apellido_casada:      '',
    tipo_de_cliente:      'N',
    cedula:               tc.cedula,
    pasaporte:            '',
    ruc:                  '',
    fecha_nacimiento:     tc.fecha_nacimiento,
    sexo:                 tc.sexo,
    telefono_Residencial: '',
    telefono_oficina:     '',
    telefono_celular:     tc.telefono_celular,
    email:                tc.email,
    tipo:                 'POLIZA',
    fecha_de_registro:    fmtDate(today),
    cantidad_de_pago:     '1',
    codigo_producto_agt:  '07159',
    nombre_producto:      'WEB - AUTORC',
    Responsable_de_cobro: 'CORREDOR',
    suma_asegurada:       '0',
    codigo_acreedor:      '',
    nombre_acreedor:      '',
    cod_marca_agt:        tc.cod_marca,
    nombre_marca:         tc.nombre_marca,
    cod_modelo_agt:       tc.cod_modelo,
    nombre_modelo:        tc.nombre_modelo,
    uso:                  'PARTICULAR',
    codigo_color_agt:     '001',
    nombre_color_agt:     'NO DEFINIDO',
    no_chasis:            tc.no_chasis,
    nombre_conductor:     tc.primer_nombre,
    apellido_conductor:   tc.primer_apellido,
    sexo_conductor:       tc.sexo,
    placa:                tc.placa,
    puertas:              '4',
    pasajeros:            '5',
    cilindros:            '4',
    vin:                  tc.no_chasis,
    no_motor:             tc.no_motor,
    ano:                  tc.ano,
    direccion:            tc.direccion,
    observacion:          '',
    agencia:              '',
    direccion_cobros:     tc.direccion,
    descuento:            '0',
    fecha_primer_pago:    fmtDate(today),
    cod_agente:           COD_AGENTE,
    opcion:               'A',
    no_cotizacion:        noCotizacion,
    cod_grupo:            '00001',
    nombre_grupo:         'SIN GRUPO',
    token:                emitToken,
    nacionalidad:         'PANAMA',
    pep:                  '002|campo_pep',
    ocupacion:            '001',
    profesion:            '1',
    pais_residencia:      'PANAMA',
    actividad_economica:  '001',
    representante_legal:  '',
    nombre_comercial:     '',
    aviso_operacion:      '',
  };

  // ── IMPRIMIR PAYLOAD ──────────────────────────────────────────
  sep(`PAYLOAD EmitirDatos — ${tc.label}`);

  console.log('\n▼ PARÁMETROS (JSON):');
  const displayParams = { ...emitParams, token: emitParams.token.substring(0, 24) + '...' };
  console.log(JSON.stringify(displayParams, null, 2));

  const envelope = buildEnvelope('EmitirDatos', emitParams);
  // Ocultar token en log visual (ANCON solo necesita los parámetros de negocio)
  const envelopeDisplay = envelope.replace(
    new RegExp(`<token>${emitParams.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</token>`),
    `<token>[TOKEN_VALIDO_OMITIDO_EN_LOG]</token>`
  );

  console.log('\n▼ SOAP ENVELOPE (XML exacto enviado):');
  console.log(envelopeDisplay);

  // Enviar a ANCON
  console.log('\n▶ Enviando EmitirDatos a ANCON...');
  const emitRes = await soap('EMIT', 'EmitirDatos', emitParams);

  console.log('\n▼ RESPUESTA RAW DE ANCON:');
  console.log(JSON.stringify(emitRes.parsed, null, 2));

  // Interpretar resultado
  let emitOk = false;
  let emitError = null;
  const er = emitRes.parsed;
  if (er && typeof er === 'object') {
    if (er.Respuesta) {
      emitError = typeof er.Respuesta === 'string'
        ? er.Respuesta
        : er.Respuesta?.[0]?.Respuesta || JSON.stringify(er.Respuesta);
    }
    for (const val of Object.values(er)) {
      if (Array.isArray(val) && val[0]?.p1 === '0') { emitOk = true; break; }
    }
  }

  results.emitOk    = emitOk;
  results.emitError = emitError;
  results.emitRaw   = er;

  if (emitOk) {
    console.log('\n  ✅ EMISIÓN REPORTADA COMO EXITOSA (p1=0)');
    // Intentar ImpresionPoliza
    console.log('\n[5/5] ImpresionPoliza...');
    const printRes = await soap('PRINT', 'ImpresionPoliza', {
      token: emitToken,
      no_poliza: poliza,
    });
    const enlace = Array.isArray(printRes.parsed)
      ? printRes.parsed[0]?.enlace_poliza
      : printRes.parsed?.enlace_poliza;
    console.log(enlace ? `  ✓ PDF: ${enlace}` : `  ✗ PDF no disponible: ${JSON.stringify(printRes.parsed).substring(0,200)}`);
    results.pdfUrl = enlace || null;
  } else {
    console.log(`\n  ❌ EMISIÓN FALLIDA: ${emitError || JSON.stringify(er).substring(0, 200)}`);
  }

  // Guardar payload en archivo para enviar a ANCON
  const outFile = `scripts/test/ancon_dt_emitirdatos_payload_${index + 1}.json`;
  fs.writeFileSync(outFile, JSON.stringify({
    descripcion:        tc.label,
    timestamp:          new Date().toISOString(),
    poliza,
    noCotizacion,
    emitirDatos_params: displayParams,
    emitirDatos_xml:    envelopeDisplay,
    respuesta_ancon:    er,
    emision_exitosa:    emitOk,
    error:              emitError,
  }, null, 2), 'utf8');
  console.log(`\n  📄 Payload guardado en: ${outFile}`);

  return results;
}

async function main() {
  sep('ANCON DT — CAPTURA DE PAYLOAD EmitirDatos (2 pruebas)');
  console.log('  Objetivo: capturar exactamente qué se envía a EmitirDatos');
  console.log('  para que el equipo técnico de ANCON pueda diagnosticar\n');

  const allResults = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    try {
      const r = await runTest(TEST_CASES[i], i);
      if (r) allResults.push(r);
    } catch (e) {
      console.error(`\n  ✗ Error en ${TEST_CASES[i].label}:`, e.message);
    }
    // Pequeña pausa entre pruebas
    if (i < TEST_CASES.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  sep('RESUMEN FINAL');
  for (const r of allResults) {
    const icon = r.emitOk ? '✅' : '❌';
    console.log(`  ${icon} ${r.label}`);
    console.log(`       Póliza:        ${r.poliza}`);
    console.log(`       NoCotizacion:  ${r.noCotizacion}`);
    console.log(`       Emisión OK:    ${r.emitOk}`);
    if (r.emitError) console.log(`       Error:         ${r.emitError}`);
    if (r.pdfUrl)    console.log(`       PDF:           ${r.pdfUrl}`);
    console.log('');
  }

  console.log('  Los payloads completos han sido guardados en:');
  console.log('    scripts/test/ancon_dt_emitirdatos_payload_1.json');
  console.log('    scripts/test/ancon_dt_emitirdatos_payload_2.json');
  console.log('\n  ► Enviar estos archivos al equipo técnico de ANCON.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
