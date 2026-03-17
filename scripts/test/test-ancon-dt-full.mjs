/**
 * ANCON DT (Daños a Terceros) Full Emission Test
 * Tests the complete flow: Token → Cotización DT → GenerarNoDocumento → EmitirDatos
 * Captures all requests and responses for diagnostic report.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';
const COD_AGENTE = '01009';
const COD_COMPANIA = '001';
const COD_SUCURSAL = '009';

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildEnvelope(method, params) {
  const xml = Object.entries(params)
    .filter(([,v]) => v !== undefined && v !== null)
    .map(([k,v]) => `<${k}>${esc(String(v))}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}

function decode(t) {
  return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'");
}

const log = [];

async function soap(method, params) {
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
    parsed = text.substring(0, 500);
  }

  const entry = {
    step: log.length + 1,
    method,
    params: { ...params },
    elapsed_ms: elapsed,
    response: parsed,
    raw_xml_snippet: text.substring(0, 600),
  };
  // Mask password/token in log
  if (entry.params.par_password) entry.params.par_password = '***';
  log.push(entry);

  return parsed;
}

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ANCON DT EMISSION — FULL DIAGNOSTIC TEST');
  console.log('  Fecha:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════\n');

  // ── STEP 1: Get token ──
  console.log('STEP 1: GenerarToken...');
  const loginRes = await soap('GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  const token = loginRes?.Login?.[0]?.Token;
  if (!token) {
    console.error('❌ Login failed:', JSON.stringify(loginRes));
    return;
  }
  console.log(`  ✓ Token: ${token.substring(0,20)}...\n`);

  // ── STEP 2: Create fresh DT cotización ──
  console.log('STEP 2: Cotización DT (producto 07159 = WEB-AUTORC)...');
  const cotParams = {
    cod_agente: COD_AGENTE,
    cod_compania: COD_COMPANIA,
    cod_sucursal: COD_SUCURSAL,
    cod_ramo: '002',
    cod_subramo: '001',
    codigo_producto_agt: '07159',
    nombre_producto: 'WEB - AUTORC',
    suma_asegurada: '0',
    cod_marca_agt: '00122',
    nombre_marca: 'TOYOTA',
    cod_modelo_agt: '10393',
    nombre_modelo: 'COROLLA',
    ano: '2025',
    uso: 'PARTICULAR',
    no_chasis: 'TEST00DT17032026001',
    vin: 'TEST00DT17032026001',
    descuento: '0',
    token,
  };
  const cotRes = await soap('Estandar', cotParams);
  console.log('  Cotización response:', JSON.stringify(cotRes).substring(0, 300));
  
  // Extract no_cotizacion
  let noCotizacion;
  if (Array.isArray(cotRes)) {
    noCotizacion = cotRes[0]?.no_cotizacion;
  } else if (typeof cotRes === 'object' && cotRes !== null) {
    // Try common patterns
    for (const [, val] of Object.entries(cotRes)) {
      if (Array.isArray(val) && val.length > 0 && val[0]?.no_cotizacion) {
        noCotizacion = val[0].no_cotizacion;
        break;
      }
    }
    if (!noCotizacion) noCotizacion = cotRes.no_cotizacion;
  }

  if (!noCotizacion) {
    console.error('❌ No se pudo obtener no_cotizacion. Intentando con cotización existente 009-1396557...');
    noCotizacion = '009-1396557';
  }
  console.log(`  ✓ Cotización: ${noCotizacion}\n`);

  // ── STEP 3: Generate policy number ──
  console.log('STEP 3: GenerarNodocumento...');
  const genDocRes = await soap('GenerarNodocumento', {
    cod_compania: COD_COMPANIA,
    cod_sucursal: COD_SUCURSAL,
    ano: '2026',
    cod_ramo: '002',
    cod_subramo: '001',
    token,
  });
  const poliza = Array.isArray(genDocRes) ? genDocRes[0]?.no_documento 
    : (typeof genDocRes === 'object' && genDocRes !== null) ? genDocRes.no_documento : undefined;
  
  if (!poliza) {
    console.error('❌ No se pudo generar número de póliza:', JSON.stringify(genDocRes));
    printDiagnostic();
    return;
  }
  console.log(`  ✓ Póliza: ${poliza}\n`);

  // ── STEP 4: Emit DT policy ──
  console.log('STEP 4: EmitirDatos (DT - producto 07159)...');
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  const emitParams = {
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
  };
  const emitRes = await soap('EmitirDatos', emitParams);
  console.log('  EmitirDatos response:', JSON.stringify(emitRes).substring(0, 400));

  // Check result
  let emitSuccess = false;
  let emitError = null;
  if (typeof emitRes === 'object' && emitRes !== null) {
    if (emitRes.Respuesta) {
      emitError = typeof emitRes.Respuesta === 'string' 
        ? emitRes.Respuesta 
        : emitRes.Respuesta?.[0]?.Respuesta;
    }
    for (const val of Object.values(emitRes)) {
      if (Array.isArray(val) && val.length > 0 && val[0]?.p1 === '0') {
        emitSuccess = true;
        break;
      }
    }
  } else if (typeof emitRes === 'string') {
    if (emitRes.includes('Token Inactivo')) emitError = 'Token Inactivo';
    else if (emitRes.includes('inspección')) emitError = emitRes;
    else emitError = emitRes;
  }

  if (emitSuccess) {
    console.log('  ✓ EMISIÓN EXITOSA!\n');
    
    // ── STEP 5: Print PDF ──
    console.log('STEP 5: ImpresionPoliza...');
    const printRes = await soap('ImpresionPoliza', { poliza, token });
    console.log('  ImpresionPoliza response:', JSON.stringify(printRes).substring(0, 300));
  } else {
    console.log(`  ❌ EMISIÓN FALLIDA: ${emitError}\n`);
  }

  // ── STEP 5 alt: Also test ListadoInspeccion and EnlazarInspeccion ──
  console.log('\n── EXTRA: Testing inspection methods ──');
  
  console.log('ListadoInspeccion (cod_agente + token)...');
  const listInsp = await soap('ListadoInspeccion', { cod_agente: COD_AGENTE, token });
  console.log('  Result:', JSON.stringify(listInsp).substring(0, 200));

  console.log('EnlazarInspeccion (no_cotizacion + token)...');
  const enlazar = await soap('EnlazarInspeccion', { no_cotizacion: noCotizacion, token });
  console.log('  Result:', JSON.stringify(enlazar).substring(0, 200));

  printDiagnostic();
}

function printDiagnostic() {
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('  DIAGNOSTIC LOG — ALL SOAP CALLS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  for (const entry of log) {
    console.log(`── Call #${entry.step}: ${entry.method} (${entry.elapsed_ms}ms) ──`);
    console.log('  Params:', JSON.stringify(entry.params, null, 2).substring(0, 500));
    console.log('  Response:', JSON.stringify(entry.response, null, 2).substring(0, 500));
    console.log('');
  }
}

main().catch(e => { console.error('Fatal:', e.message); printDiagnostic(); });
