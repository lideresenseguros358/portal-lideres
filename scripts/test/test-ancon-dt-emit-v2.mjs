/**
 * ANCON DT Emission v2 — Fix FK constraint error
 * Fetch valid catalog codes first, then emit with proper values.
 * Single token flow.
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
  console.log(`  [${label}] ${method} (${elapsed}ms)`);
  return parsed;
}

function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }

async function main() {
  console.log('═══ ANCON DT EMISSION v2 — WITH CATALOG CODES ═══\n');

  // 1. Login
  const loginRes = await soap('LOGIN', 'GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  const token = loginRes?.Login?.[0]?.Token;
  if (!token) { console.error('FATAL: Login failed'); return; }
  console.log(`  Token: ${token.substring(0,20)}...\n`);

  // 2. Fetch catalog codes we need
  console.log('── Fetching catalogs ──');
  
  const pepRes = await soap('PEP', 'ListaPep', { token });
  console.log('  PEP options:', JSON.stringify(pepRes).substring(0, 200));
  
  const ocupRes = await soap('OCUP', 'ListaOcupacion', { token });
  const firstOcup = Array.isArray(ocupRes) ? ocupRes[0] : null;
  console.log('  First ocupacion:', JSON.stringify(firstOcup));
  
  const profRes = await soap('PROF', 'ListaProfesion', { token });
  const firstProf = Array.isArray(profRes) ? profRes[0] : null;
  console.log('  First profesion:', JSON.stringify(firstProf));
  
  const paisRes = await soap('PAIS', 'ListaPais', { token });
  // Find PANAMA
  let paisPanama = null;
  if (Array.isArray(paisRes)) {
    paisPanama = paisRes.find(p => p.nombre && p.nombre.includes('PANAM'));
    if (!paisPanama) paisPanama = paisRes[0];
  }
  console.log('  Pais Panama:', JSON.stringify(paisPanama));
  
  const actRes = await soap('ACT', 'ListaActividad', { token });
  const firstAct = Array.isArray(actRes) ? actRes[0] : null;
  console.log('  First actividad:', JSON.stringify(firstAct));

  // Also fetch ListadoGrupos to see valid group codes
  const gruposRes = await soap('GRUPOS', 'ListadoGrupos', { token });
  console.log('  Grupos:', JSON.stringify(gruposRes).substring(0, 300));

  console.log('');

  // 3. Estandar DT cotización
  console.log('── Estandar (DT 07159) ──');
  const cotRes = await soap('COT', 'Estandar', {
    token,
    cod_marca: '00122', cod_modelo: '10393', ano: '2025',
    suma_asegurada: '0', cod_producto: '07159',
    cedula: '8-888-9999', nombre: 'JUAN', apellido: 'PEREZ',
    vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
    fecha_nac: '16/06/1994', nuevo: '0', responsable: 'CORREDOR',
  });

  let noCotizacion = null;
  if (cotRes?.cotizacion) {
    for (const items of Object.values(cotRes.cotizacion)) {
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.Cobertura === 'NoCotizacion') { noCotizacion = item.Descripcion1; break; }
        }
      }
      if (noCotizacion) break;
    }
  }
  console.log(`  NoCotizacion: ${noCotizacion}\n`);
  if (!noCotizacion) { console.error('FATAL: No cotización'); return; }

  // 4. GenerarNodocumento
  console.log('── GenerarNodocumento ──');
  const genRes = await soap('GENDOC', 'GenerarNodocumento', {
    cod_compania: '001', cod_sucursal: '009', ano: '2026',
    cod_ramo: '002', cod_subramo: '001', token,
  });
  const poliza = Array.isArray(genRes) ? genRes[0]?.no_documento : genRes?.no_documento;
  if (!poliza) { console.error('FATAL: No poliza'); return; }
  console.log(`  Póliza: ${poliza}\n`);

  // 5. EmitirDatos — with valid catalog codes
  console.log('── EmitirDatos (DT, with catalog codes) ──');
  const today = new Date();
  const nextYear = new Date(today); nextYear.setFullYear(nextYear.getFullYear() + 1);

  // Use first valid codes from catalogs
  const ocupCode = firstOcup?.cod_ocupacion || '';
  const profCode = firstProf?.cod_profesion || '';
  const paisCode = paisPanama?.nombre || 'PANAMA';
  const actCode = firstAct?.cod_actividad || '';

  console.log(`  Using: ocupacion=${ocupCode}, profesion=${profCode}, pais=${paisCode}, actividad=${actCode}`);

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
    telefono_Residencial: '2221133',
    telefono_oficina: '2221133',
    telefono_celular: '6000-0001',
    email: 'test@test.com',
    tipo: 'POLIZA',
    fecha_de_registro: fmtDate(today),
    cantidad_de_pago: '10',
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
    no_chasis: 'JTDKN3DU5A0000001',
    nombre_conductor: 'JUAN',
    apellido_conductor: 'PEREZ',
    sexo_conductor: 'M',
    placa: '000000',
    puertas: '4',
    pasajeros: '5',
    cilindros: '4',
    vin: 'JTDKN3DU5A0000001',
    no_motor: '1NZ0000001',
    ano: '2025',
    direccion: 'PANAMA CITY',
    observacion: 'TEST',
    agencia: '',
    direccion_cobros: 'PANAMA CITY',
    descuento: '0',
    fecha_primer_pago: fmtDate(today),
    cod_agente: COD_AGENTE,
    opcion: 'A',
    no_cotizacion: noCotizacion,
    cod_grupo: '00001',
    nombre_grupo: 'SIN GRUPO',
    token,
    nacionalidad: paisCode,
    pep: '0',
    ocupacion: ocupCode,
    profesion: profCode,
    pais_residencia: paisCode,
    actividad_economica: actCode,
    representante_legal: '',
    nombre_comercial: '',
    aviso_operacion: '',
  };

  const emitRes = await soap('EMIT', 'EmitirDatos', emitParams);
  console.log('  EmitirDatos response:', JSON.stringify(emitRes).substring(0, 500));
  console.log('');

  // Check result
  let emitOk = false;
  let emitError = null;
  if (typeof emitRes === 'string') {
    emitError = emitRes;
  } else if (typeof emitRes === 'object' && emitRes !== null) {
    if (emitRes.Respuesta) {
      emitError = typeof emitRes.Respuesta === 'string' ? emitRes.Respuesta
        : Array.isArray(emitRes.Respuesta) ? emitRes.Respuesta[0]?.Respuesta : JSON.stringify(emitRes.Respuesta);
    }
    for (const val of Object.values(emitRes)) {
      if (Array.isArray(val) && val[0]?.p1 === '0') { emitOk = true; break; }
    }
  }

  if (emitOk) {
    console.log('🎉 EMISIÓN DT EXITOSA!\n');
    console.log('── ImpresionPoliza ──');
    const printRes = await soap('PRINT', 'ImpresionPoliza', { token, no_poliza: poliza });
    console.log('  PrintResult:', JSON.stringify(printRes).substring(0, 300));
  } else {
    console.log(`❌ EMISIÓN FALLIDA: ${emitError}`);
    
    if (emitError && emitError.includes('inspecci')) {
      console.log('\n→ Fresh DT cotización STILL requires inspection.');
      console.log('→ ANCON sets inspection flag for ALL products including DT (07159).');
      console.log('→ This is confirmed ANCON-side behavior requiring their support.');
    }
  }
}

main().catch(e => console.error('Fatal:', e));
