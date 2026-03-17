/**
 * ANCON DT Emission — Exhaustive Diagnostic
 * 1. GenerarToken + ValidarToken
 * 2. Estandar cotización (DT product 07159) with CORRECT params from quotes.service.ts
 * 3. GenerarNodocumento
 * 4. EmitirDatos
 * 5. ImpresionPoliza (with no_poliza per docs)
 * 
 * Also tests ListadoInspeccion and EnlazarInspeccion for completeness.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';
const COD_AGENTE = '01009';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function buildEnvelope(method, params) {
  const xml = Object.entries(params)
    .filter(([,v]) => v !== undefined && v !== null)
    .map(([k,v]) => `<${k}>${esc(String(v))}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}

function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

const diagnosticLog = [];

async function soap(stepLabel, method, params) {
  const body = buildEnvelope(method, params);
  const t0 = Date.now();
  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` },
    body,
  });
  const text = await res.text();
  const elapsed = Date.now() - t0;

  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) {
    const decoded = decode(m[1]);
    try { parsed = JSON.parse(decoded); } catch { parsed = decoded; }
  } else {
    parsed = text.substring(0, 800);
  }

  // Safe copy of params for logging
  const safeParams = { ...params };
  if (safeParams.par_password) safeParams.par_password = '***';
  if (safeParams.token) safeParams.token = safeParams.token.substring(0, 16) + '...';
  if (safeParams.par_token) safeParams.par_token = safeParams.par_token.substring(0, 16) + '...';

  diagnosticLog.push({ step: stepLabel, method, params: safeParams, elapsed_ms: elapsed, response: parsed });

  const isError = typeof parsed === 'string' && parsed.includes('Token Inactivo');
  const mark = isError ? '❌' : '✓';
  console.log(`  ${mark} [${stepLabel}] ${method} → ${elapsed}ms`);
  console.log(`    Response: ${JSON.stringify(parsed).substring(0, 250)}`);
  return parsed;
}

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ANCON DT EMISSION — EXHAUSTIVE DIAGNOSTIC');
  console.log('  Fecha:', new Date().toISOString());
  console.log('  Endpoint:', SOAP_URL);
  console.log('  Usuario:', USUARIO);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── 1. GenerarToken ──
  console.log('── STEP 1: GenerarToken ──');
  const loginRes = await soap('1-LOGIN', 'GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  const token = loginRes?.Login?.[0]?.Token;
  if (!token) { console.error('FATAL: Login failed'); return printReport(); }
  console.log(`  Token: ${token.substring(0, 24)}...\n`);

  // ── 2. ValidarToken — confirm token is active ──
  console.log('── STEP 2: ValidarToken ──');
  const validRes = await soap('2-VALIDAR', 'ValidarToken', { par_token: token });
  console.log('');

  // ── 3. Estandar cotización — DT product 07159 ──
  // Use the EXACT same params as quotes.service.ts (cod_marca, cod_modelo, etc.)
  console.log('── STEP 3: Estandar (DT cotización, producto 07159) ──');
  const cotRes = await soap('3-COT-DT', 'Estandar', {
    cod_marca: '00122',
    cod_modelo: '10393',
    ano: '2025',
    suma_asegurada: '0',
    cod_producto: '07159',
    cedula: '8-888-9999',
    nombre: 'JUAN',
    apellido: 'PEREZ',
    vigencia: 'A',
    email: 'test@test.com',
    tipo_persona: 'N',
    fecha_nac: '16/06/1994',
    nuevo: '0',
    token,
  });

  // Extract no_cotizacion from cotización response
  let noCotizacion = null;
  if (Array.isArray(cotRes)) {
    // Look for NoCotizacion entry
    for (const item of cotRes) {
      if (item.Cobertura === 'NoCotizacion' || item.no_cotizacion) {
        noCotizacion = item.Descripcion1 || item.no_cotizacion;
        break;
      }
    }
  }
  console.log(`  Cotización extraída: ${noCotizacion || 'NO ENCONTRADA'}\n`);

  if (!noCotizacion) {
    console.log('  ⚠ No se pudo crear cotización DT fresca.');
    console.log('  Probando con cotización existente 009-1396557...\n');
    noCotizacion = '009-1396557';
  }

  // ── 4. GenerarNodocumento ──
  console.log('── STEP 4: GenerarNodocumento ──');
  const genRes = await soap('4-GENDOC', 'GenerarNodocumento', {
    cod_compania: '001',
    cod_sucursal: '009',
    ano: '2026',
    cod_ramo: '002',
    cod_subramo: '001',
    token,
  });
  const poliza = Array.isArray(genRes) ? genRes[0]?.no_documento
    : (typeof genRes === 'object' && genRes !== null) ? genRes?.no_documento : null;
  console.log(`  Póliza: ${poliza || 'FALLO'}\n`);

  if (!poliza) { console.error('FATAL: No se generó póliza'); return printReport(); }

  // ── 5. EmitirDatos — DT emission ──
  console.log('── STEP 5: EmitirDatos (DT, producto 07159) ──');
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  const emitRes = await soap('5-EMITIR', 'EmitirDatos', {
    poliza,
    ramo_agt: 'AUTOMOVIL',
    vigencia_inicial: fmtDate(today),
    vigencia_final: fmtDate(nextYear),
    primer_nombre: 'JUAN',
    segundo_nombre: '',
    primer_apellido: 'PEREZ',
    segundo_apellido: '',
    apellido_casada: '',
    tipo_de_cliente: 'N',
    cedula: '8-888-9999',
    pasaporte: '',
    ruc: '',
    fecha_nacimiento: '16/06/1994',
    sexo: 'M',
    telefono_Residencial: '',
    telefono_oficina: '',
    telefono_celular: '6000-0001',
    email: 'test@test.com',
    tipo: 'POLIZA',
    fecha_de_registro: fmtDate(today),
    cantidad_de_pago: '1',
    codigo_producto_agt: '07159',
    nombre_producto: 'WEB - AUTORC',
    Responsable_de_cobro: 'CORREDOR',
    suma_asegurada: '0',
    codigo_acreedor: '',
    nombre_acreedor: '',
    cod_marca_agt: '00122',
    nombre_marca: 'TOYOTA',
    cod_modelo_agt: '10393',
    nombre_modelo: 'COROLLA',
    uso: 'PARTICULAR',
    codigo_color_agt: '001',
    nombre_color_agt: 'NO DEFINIDO',
    no_chasis: 'TEST00DT17032026001',
    nombre_conductor: 'JUAN',
    apellido_conductor: 'PEREZ',
    sexo_conductor: 'M',
    placa: 'TST123',
    puertas: '4',
    pasajeros: '5',
    cilindros: '4',
    vin: 'TEST00DT17032026001',
    no_motor: 'TESTMOTOR001',
    ano: '2025',
    direccion: 'PANAMA',
    observacion: '',
    agencia: '',
    direccion_cobros: 'PANAMA',
    descuento: '0',
    fecha_primer_pago: fmtDate(today),
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

  // Check emission result
  let emitOk = false;
  let emitError = null;
  if (typeof emitRes === 'object' && emitRes !== null) {
    if (emitRes.Respuesta) {
      emitError = typeof emitRes.Respuesta === 'string' ? emitRes.Respuesta
        : Array.isArray(emitRes.Respuesta) ? emitRes.Respuesta[0]?.Respuesta : JSON.stringify(emitRes.Respuesta);
    }
    for (const val of Object.values(emitRes)) {
      if (Array.isArray(val) && val[0]?.p1 === '0') { emitOk = true; break; }
    }
  } else if (typeof emitRes === 'string') {
    emitError = emitRes;
  }

  if (emitOk) {
    console.log('  ✓ EMISIÓN EXITOSA!\n');
    // ── 6. ImpresionPoliza ──
    console.log('── STEP 6: ImpresionPoliza ──');
    // Doc says param is "no_poliza", not "poliza"
    await soap('6A-PRINT-no_poliza', 'ImpresionPoliza', { no_poliza: poliza, token });
    // Also try "poliza" in case
    await soap('6B-PRINT-poliza', 'ImpresionPoliza', { poliza, token });
  } else {
    console.log(`  ❌ EMISIÓN FALLIDA: ${emitError}\n`);

    // ── EXTRA: Try with the old cotización too ──
    if (noCotizacion !== '009-1396557') {
      console.log('── EXTRA: Re-intentar con cotización existente 009-1396557 ──');
      const emitRes2 = await soap('5B-EMITIR-OLD', 'EmitirDatos', {
        poliza,
        ramo_agt: 'AUTOMOVIL',
        vigencia_inicial: fmtDate(today),
        vigencia_final: fmtDate(nextYear),
        primer_nombre: 'JUAN', segundo_nombre: '', primer_apellido: 'PEREZ',
        segundo_apellido: '', apellido_casada: '', tipo_de_cliente: 'N',
        cedula: '8-888-9999', pasaporte: '', ruc: '',
        fecha_nacimiento: '16/06/1994', sexo: 'M',
        telefono_Residencial: '', telefono_oficina: '', telefono_celular: '6000-0001',
        email: 'test@test.com', tipo: 'POLIZA', fecha_de_registro: fmtDate(today),
        cantidad_de_pago: '1', codigo_producto_agt: '07159',
        nombre_producto: 'WEB - AUTORC', Responsable_de_cobro: 'CORREDOR',
        suma_asegurada: '0', codigo_acreedor: '', nombre_acreedor: '',
        cod_marca_agt: '00122', nombre_marca: 'TOYOTA',
        cod_modelo_agt: '10393', nombre_modelo: 'COROLLA',
        uso: 'PARTICULAR', codigo_color_agt: '001', nombre_color_agt: 'NO DEFINIDO',
        no_chasis: 'TEST00DT17032026001', nombre_conductor: 'JUAN',
        apellido_conductor: 'PEREZ', sexo_conductor: 'M', placa: 'TST123',
        puertas: '4', pasajeros: '5', cilindros: '4',
        vin: 'TEST00DT17032026001', no_motor: 'TESTMOTOR001', ano: '2025',
        direccion: 'PANAMA', observacion: '', agencia: '', direccion_cobros: 'PANAMA',
        descuento: '0', fecha_primer_pago: fmtDate(today),
        cod_agente: COD_AGENTE, opcion: 'A', no_cotizacion: '009-1396557',
        cod_grupo: '00001', nombre_grupo: 'SIN GRUPO', token,
        nacionalidad: 'PANAMA', pep: '0',
      });
      console.log('');
    }
  }

  // ── EXTRA: Inspection methods ──
  console.log('── EXTRA: ListadoInspeccion ──');
  await soap('X1-LISTINSP', 'ListadoInspeccion', { token, cod_agente: COD_AGENTE });
  console.log('');

  console.log('── EXTRA: EnlazarInspeccion ──');
  await soap('X2-ENLAZAR', 'EnlazarInspeccion', { token, inspeccion: '0', cotizacion: noCotizacion });
  console.log('');

  printReport();
}

function printReport() {
  console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              REPORTE DIAGNÓSTICO COMPLETO                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  for (const e of diagnosticLog) {
    const isErr = (typeof e.response === 'string' && (e.response.includes('Token Inactivo') || e.response.includes('pendiente')))
      || (typeof e.response === 'object' && e.response?.Respuesta);
    console.log(`[${e.step}] ${e.method} (${e.elapsed_ms}ms) ${isErr ? '❌ ERROR' : '✓ OK'}`);
    console.log(`  Params enviados: ${JSON.stringify(e.params)}`);
    console.log(`  Response: ${JSON.stringify(e.response).substring(0, 400)}`);
    console.log('');
  }

  // Summary
  const errors = diagnosticLog.filter(e =>
    (typeof e.response === 'string' && (e.response.includes('Token Inactivo') || e.response.includes('pendiente')))
    || (typeof e.response === 'object' && e.response?.Respuesta)
  );
  console.log(`\nTotal calls: ${diagnosticLog.length}, Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nERRORES ENCONTRADOS:');
    for (const e of errors) {
      const errMsg = typeof e.response === 'string' ? e.response
        : (e.response?.Respuesta || JSON.stringify(e.response).substring(0, 200));
      console.log(`  - [${e.step}] ${e.method}: ${errMsg}`);
    }
  }
}

main().catch(e => { console.error('Fatal:', e.message); printReport(); });
