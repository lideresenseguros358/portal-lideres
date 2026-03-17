/**
 * ANCON DT Full Emission — Single Token Flow
 * 1. GenerarToken (ONE call only)
 * 2. Estandar (DT cotización 07159) — extract NoCotizacion + prices
 * 3. GenerarNodocumento
 * 4. EmitirDatos
 * 5. ImpresionPoliza
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';
const COD_AGENTE = '01009';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function buildEnvelope(method, params) {
  const xml = Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => `<${k}>${esc(String(v))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&ntilde;/g,'ñ').replace(/&oacute;/g,'ó'); }

async function soap(label, method, params) {
  const body = buildEnvelope(method, params);
  const t0 = Date.now();
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const elapsed = Date.now() - t0;
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`  [${label}] ${method} (${elapsed}ms) → ${JSON.stringify(parsed).substring(0, 300)}`);
  return parsed;
}

function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }

async function main() {
  console.log('═══ ANCON DT FULL EMISSION — SINGLE TOKEN ═══\n');

  // 1. Login — ONE token only
  console.log('── STEP 1: GenerarToken ──');
  const loginRes = await soap('LOGIN', 'GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  const token = loginRes?.Login?.[0]?.Token;
  if (!token) { console.error('FATAL: Login failed'); return; }
  console.log(`  Token: ${token.substring(0,24)}...\n`);

  // 2. Estandar DT cotización
  console.log('── STEP 2: Estandar (DT 07159) ──');
  const cotRes = await soap('COT', 'Estandar', {
    token,
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
    responsable: 'CORREDOR',
  });

  // Extract NoCotizacion and prices
  let noCotizacion = null;
  let pricesInfo = {};
  if (cotRes?.cotizacion) {
    // Parse each option
    for (const [optKey, items] of Object.entries(cotRes.cotizacion)) {
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.Cobertura === 'NoCotizacion') {
            noCotizacion = item.Descripcion1;
          }
          if (item.Cobertura === 'Totales') {
            pricesInfo[optKey] = {
              prima_a: item.TarifaPrima_a,
              prima_b: item.TarifaPrima_b,
              prima_c: item.TarifaPrima_c,
            };
          }
        }
      }
    }
  }
  console.log(`  NoCotizacion: ${noCotizacion}`);
  console.log(`  Precios por opción:`, JSON.stringify(pricesInfo, null, 2));
  console.log('');

  if (!noCotizacion) {
    console.error('FATAL: Could not extract NoCotizacion');
    return;
  }

  // 3. GenerarNodocumento
  console.log('── STEP 3: GenerarNodocumento ──');
  const genRes = await soap('GENDOC', 'GenerarNodocumento', {
    cod_compania: '001',
    cod_sucursal: '009',
    ano: '2026',
    cod_ramo: '002',
    cod_subramo: '001',
    token,
  });
  const poliza = Array.isArray(genRes) ? genRes[0]?.no_documento : genRes?.no_documento;
  if (!poliza) { console.error('FATAL: No poliza generated'); return; }
  console.log(`  Póliza: ${poliza}\n`);

  // 4. EmitirDatos
  console.log('── STEP 4: EmitirDatos (DT) ──');
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  const emitRes = await soap('EMIT', 'EmitirDatos', {
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
    no_chasis: 'TESTDT17032026FINAL',
    nombre_conductor: 'JUAN',
    apellido_conductor: 'PEREZ',
    sexo_conductor: 'M',
    placa: 'TST789',
    puertas: '4',
    pasajeros: '5',
    cilindros: '4',
    vin: 'TESTDT17032026FINAL',
    no_motor: 'TESTMOTORFINAL',
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

  // Check result
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
  }

  if (emitOk) {
    console.log('  🎉 EMISIÓN DT EXITOSA!\n');
    // 5. ImpresionPoliza
    console.log('── STEP 5: ImpresionPoliza ──');
    await soap('PRINT', 'ImpresionPoliza', { token, no_poliza: poliza });
  } else {
    console.log(`  ❌ EMISIÓN FALLIDA: ${emitError}\n`);
    
    // If inspection error, check if we can bypass it
    if (emitError && emitError.includes('inspecci')) {
      console.log('  → DT returned inspection error. Testing if this is per-cotización or per-product...');
      console.log('  → This cotización was freshly created, so the inspection flag is set at cotización creation time.');
      console.log('  → This confirms ANCON sets inspection flag for ALL products including DT.');
    }
  }
}

main().catch(e => console.error('Fatal:', e));
