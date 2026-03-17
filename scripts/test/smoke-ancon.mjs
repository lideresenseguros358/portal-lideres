/**
 * Smoke Test: ANCÓN Seguros — DT + CC Cotización → Emisión → Carátula
 *
 * Usage:
 *   node scripts/test/smoke-ancon.mjs          # Full test (cotización + emisión + carátula)
 *   node scripts/test/smoke-ancon.mjs cot      # Cotización only
 *   node scripts/test/smoke-ancon.mjs emit     # Emisión only (needs cotización first)
 *   node scripts/test/smoke-ancon.mjs print 009-XXXXX  # Print cotización
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';
const COD_AGENTE = '00099';

function soapEnvelope(method, params) {
  const px = Object.entries(params)
    .map(([k, v]) => `<${k}>${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros">
  <soap:Body><tns:${method}>${px}</tns:${method}></soap:Body>
</soap:Envelope>`;
}

async function soap(method, params) {
  console.log(`\n--- SOAP: ${method} ---`);
  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` },
    body: soapEnvelope(method, params),
  });
  const text = await res.text();
  console.log(`  HTTP ${res.status}`);

  // Parse SOAP response
  let match = text.match(/<return[^>]*>([\s\S]*?)<\/return>/) || text.match(/<data[^>]*>([\s\S]*?)<\/data>/);
  if (!match) match = text.match(/<ns1:\w+Response[^>]*>([\s\S]*?)<\/ns1:\w+Response>/);
  if (!match) { console.log('  Raw:', text.substring(0, 300)); return text; }

  let decoded = match[1]
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  const jm = decoded.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jm) {
    try {
      const data = JSON.parse(jm[1]);
      console.log('  Data:', JSON.stringify(data).substring(0, 500));
      return data;
    } catch {}
  }
  console.log('  Decoded:', decoded.substring(0, 300));
  return decoded;
}

async function getToken() {
  const login = await soap('GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  const token = login?.Login?.[0]?.Token;
  if (!token) throw new Error('Failed to get token');
  console.log(`\n✅ Token: ${token.substring(0, 20)}...`);
  return token;
}

// ═══════════════════════════════════════
// COTIZACIÓN TEST
// ═══════════════════════════════════════
async function testCotizacion(token) {
  console.log('\n╔══════════════════════════════════╗');
  console.log('║   ANCON COTIZACIÓN SMOKE TEST    ║');
  console.log('╚══════════════════════════════════╝');

  const cot = await soap('Estandar', {
    token,
    cod_marca: '00122',
    cod_modelo: '10393',
    ano: '2024',
    suma_asegurada: '18000',
    cod_producto: '00312',
    cedula: '8-888-9999',
    nombre: 'SMOKE',
    apellido: 'TEST',
    vigencia: 'A',
    email: 'smoke@lideresenseguros.com',
    tipo_persona: 'N',
    fecha_nac: '16/06/1994',
    nuevo: '0',
  });

  if (!cot?.cotizacion) {
    console.log('\n❌ Cotización failed');
    return null;
  }

  const results = {};
  for (const [key, coverages] of Object.entries(cot.cotizacion)) {
    if (!Array.isArray(coverages)) continue;
    const totals = coverages.find(c => c.Cobertura === 'Totales');
    const noCot = coverages.find(c => c.Cobertura === 'NoCotizacion');
    if (totals && noCot) {
      results[key] = {
        noCotizacion: noCot.Descripcion1,
        totalA: totals.TarifaPrima_a,
        totalB: totals.TarifaPrima_b,
        totalC: totals.TarifaPrima_c,
      };
      console.log(`\n  ${key}: NoCot=${noCot.Descripcion1} | Total: a=$${totals.TarifaPrima_a} b=$${totals.TarifaPrima_b} c=$${totals.TarifaPrima_c}`);
    }
  }

  const firstOption = Object.values(results)[0];
  if (firstOption) {
    console.log(`\n✅ Cotización exitosa. NoCotización: ${firstOption.noCotizacion}`);
  }

  return results;
}

// ═══════════════════════════════════════
// EMISIÓN TEST (requires active cotización)
// ═══════════════════════════════════════
async function testEmision(token, noCotizacion) {
  console.log('\n╔══════════════════════════════════╗');
  console.log('║   ANCON EMISIÓN SMOKE TEST       ║');
  console.log('╚══════════════════════════════════╝');
  console.log(`  Using cotización: ${noCotizacion}`);

  // Step 1: Generate policy number
  const ano = new Date().getFullYear().toString();
  const docResult = await soap('GenerarNodocumento', {
    cod_compania: '001',
    cod_sucursal: '009',
    ano,
    cod_ramo: '002',
    cod_subramo: '001',
    token,
  });

  let noDocumento = null;
  if (Array.isArray(docResult)) {
    noDocumento = docResult[0]?.no_documento;
  } else if (docResult && typeof docResult === 'object') {
    noDocumento = docResult.no_documento;
  }

  if (!noDocumento) {
    console.log('\n❌ GenerarNodocumento failed');
    console.log('  Result:', JSON.stringify(docResult).substring(0, 300));
    return null;
  }
  console.log(`\n✅ Policy number generated: ${noDocumento}`);

  // Step 2: Emit policy
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const fmt = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  const emisionResult = await soap('EmisionServer', {
    poliza: noDocumento,
    ramo_agt: 'AUTOMOVIL',
    vigencia_inicial: fmt(today),
    vigencia_final: fmt(nextYear),
    primer_nombre: 'SMOKE',
    segundo_nombre: '',
    primer_apellido: 'TEST',
    segundo_apellido: 'LIDERES',
    apellido_casada: '',
    tipo_de_cliente: 'N',
    cedula: '8-888-9999',
    pasaporte: '',
    ruc: '',
    fecha_nacimiento: '16/06/1994',
    sexo: 'M',
    telefono_Residencial: '2900000',
    telefono_oficina: '',
    telefono_celular: '62900000',
    email: 'smoke@lideresenseguros.com',
    tipo: 'POLIZA',
    fecha_de_registro: fmt(today),
    cantidad_de_pago: '10',
    codigo_producto_agt: '00312',
    nombre_producto: 'AUTO COMPLETA',
    Responsable_de_cobro: 'CORREDOR',
    suma_asegurada: '18000',
    codigo_acreedor: '',
    nombre_acreedor: '',
    cod_marca_agt: '00122',
    nombre_marca: 'TOYOTA',
    cod_modelo_agt: '10393',
    nombre_modelo: 'COROLLA',
    uso: 'PARTICULAR',
    codigo_color_agt: '001',
    nombre_color_agt: 'BLANCO',
    no_chasis: 'JTDBR32E160654321',
    nombre_conductor: 'SMOKE',
    apellido_conductor: 'TEST',
    sexo_conductor: 'M',
    placa: 'SMK1234',
    puertas: '4',
    pasajeros: '5',
    cilindros: '4',
    vin: 'JTDBR32E160654321',
    no_motor: 'SMK987654',
    ano: '2024',
    direccion: 'CIUDAD DE PANAMA',
    observacion: 'PRUEBA SMOKE TEST',
    agencia: '',
    direccion_cobros: 'CIUDAD DE PANAMA',
    descuento: '0',
    fecha_primer_pago: fmt(today),
    cod_agente: COD_AGENTE,
    opcion: 'A',
    no_cotizacion: noCotizacion,
    cod_grupo: '00001',
    nombre_grupo: 'SIN GRUPO',
    token,
    nacionalidad: 'PANAMA',
    pep: '0',
    ocupacion: '',
    profesion: '',
    pais_residencia: '',
    actividad_economica: '',
    representante_legal: '',
    nombre_comercial: '',
    aviso_operacion: '',
  });

  // Check result
  const raw = emisionResult;
  let success = false;
  let message = '';

  if (typeof raw === 'object' && raw !== null) {
    // Check for error
    if (raw.Respuesta && Array.isArray(raw.Respuesta)) {
      message = raw.Respuesta[0]?.Respuesta || 'Unknown error';
      console.log(`\n❌ Emisión error: ${message}`);
    }
    // Check for success (key is empty string)
    const successArr = raw[''];
    if (successArr && Array.isArray(successArr) && successArr[0]?.p1 === '0') {
      success = true;
      message = successArr[0].p2 || 'Exito';
      console.log(`\n✅ Emisión exitosa: ${message}`);
    }
    // Check other patterns
    for (const [key, val] of Object.entries(raw)) {
      if (Array.isArray(val) && val.length > 0 && val[0]?.p1 === '0') {
        success = true;
        message = val[0].p2 || 'Exito';
      }
    }
  }

  if (success) {
    console.log(`\n✅ POLIZA EMITIDA: ${noDocumento}`);
    return noDocumento;
  }

  console.log('\n⚠️ Emisión result:', JSON.stringify(raw).substring(0, 500));
  return noDocumento; // Return anyway for print test
}

// ═══════════════════════════════════════
// CARÁTULA TEST
// ═══════════════════════════════════════
async function testPrintPoliza(token, noPoliza) {
  console.log('\n╔══════════════════════════════════╗');
  console.log('║   ANCON PRINT POLIZA TEST        ║');
  console.log('╚══════════════════════════════════╝');
  console.log(`  Poliza: ${noPoliza}`);

  const result = await soap('ImpresionPoliza', { token, no_poliza: noPoliza });

  let enlace = null;
  if (Array.isArray(result)) {
    enlace = result[0]?.enlace_poliza;
  } else if (result && typeof result === 'object') {
    enlace = result.enlace_poliza;
  }

  if (enlace && !enlace.includes('no disponible')) {
    console.log(`\n✅ PDF URL: ${enlace}`);

    // Try to download the PDF
    try {
      const pdfRes = await fetch(enlace);
      console.log(`  PDF Status: ${pdfRes.status}`);
      if (pdfRes.ok) {
        const { writeFileSync } = await import('fs');
        const buffer = Buffer.from(await pdfRes.arrayBuffer());
        const filename = `caratula_ancon_${noPoliza.replace(/\//g, '-')}.pdf`;
        writeFileSync(filename, buffer);
        console.log(`  ✅ PDF saved: ${filename} (${buffer.length} bytes)`);
      }
    } catch (e) {
      console.log(`  ⚠️ PDF download error: ${e.message}`);
    }
  } else {
    console.log(`\n⚠️ No PDF available: ${enlace || JSON.stringify(result).substring(0, 300)}`);
  }

  return enlace;
}

async function testPrintCotizacion(token, noCotizacion) {
  console.log('\n--- Print Cotización ---');
  const result = await soap('ImpresionCotizacion', { token, no_cotizacion: noCotizacion });

  let enlace = null;
  if (Array.isArray(result)) {
    enlace = result[0]?.enlace_cotizacion;
  } else if (result && typeof result === 'object') {
    enlace = result.enlace_cotizacion;
  }

  if (enlace && !enlace.includes('no disponible')) {
    console.log(`\n✅ Cotización PDF URL: ${enlace}`);
  } else {
    console.log(`\n⚠️ No cotización PDF: ${enlace || JSON.stringify(result).substring(0, 300)}`);
  }

  return enlace;
}

// ═══════════════════════════════════════
// CATALOGS TEST
// ═══════════════════════════════════════
async function testCatalogs(token) {
  console.log('\n╔══════════════════════════════════╗');
  console.log('║   ANCON CATALOGS TEST            ║');
  console.log('╚══════════════════════════════════╝');

  // Test a few catalogs
  const catalogs = [
    ['ListaFormaPago', {}],
    ['ListaFrecuenciaPago', {}],
    ['ListaProvincia', {}],
    ['GenerarAcreedores', {}],
  ];

  for (const [method, params] of catalogs) {
    const result = await soap(method, { token, ...params });
    const count = Array.isArray(result) ? result.length : 'N/A';
    console.log(`  ${method}: ${count} items`);
  }
}

// ═══════════════════════════════════════
// MAIN
// ═══════════════════════════════════════
const arg = process.argv[2] || 'all';

(async () => {
  const token = await getToken();

  if (arg === 'cot') {
    const results = await testCotizacion(token);
    if (results) {
      const firstNoCot = Object.values(results)[0]?.noCotizacion;
      if (firstNoCot) await testPrintCotizacion(token, firstNoCot);
    }
  } else if (arg === 'emit') {
    const noCot = process.argv[3];
    if (!noCot) { console.log('Usage: smoke-ancon.mjs emit <noCotizacion>'); return; }
    const poliza = await testEmision(token, noCot);
    if (poliza) await testPrintPoliza(token, poliza);
  } else if (arg === 'print') {
    const poliza = process.argv[3];
    if (!poliza) { console.log('Usage: smoke-ancon.mjs print <noPoliza>'); return; }
    await testPrintPoliza(token, poliza);
  } else if (arg === 'catalogs') {
    await testCatalogs(token);
  } else {
    // Full test: cotización → emisión → carátula
    const results = await testCotizacion(token);

    if (results) {
      const firstNoCot = Object.values(results)[0]?.noCotizacion;
      if (firstNoCot) {
        await testPrintCotizacion(token, firstNoCot);

        // Try emission
        console.log('\n⚠️  NOTE: ANCON emission permissions may still be pending.');
        console.log('    If EmisionServer fails, it means ANCON hasn\'t enabled emission access yet.\n');
        const poliza = await testEmision(token, firstNoCot);
        if (poliza) {
          await testPrintPoliza(token, poliza);
        }
      }
    }

    await testCatalogs(token);
  }

  console.log('\n\n═══ ANCON SMOKE TEST COMPLETE ═══');
})().catch(e => console.error('\nFATAL:', e.message));
