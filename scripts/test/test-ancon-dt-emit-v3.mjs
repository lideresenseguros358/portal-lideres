/**
 * ANCON DT Emission v3 — Systematically fix FK constraint
 * Test with different values for suspect FK fields:
 * - cod_grupo (ListadoGrupos returned null)
 * - cantidad_de_pago 
 * - codigo_color_agt
 * - ocupacion/profesion/actividad_economica/pais_residencia
 * 
 * Also fetch ListaFrecuenciaPago, ListaFormaPago for valid values.
 * Also try GuardarCliente flow which may be required before EmitirDatos.
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
  if (label) console.log(`  [${label}] ${method} (${elapsed}ms)`);
  return parsed;
}

function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }

async function main() {
  console.log('═══ ANCON DT EMISSION v3 — FK CONSTRAINT DEBUG ═══\n');

  const loginRes = await soap('LOGIN', 'GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  const token = loginRes?.Login?.[0]?.Token;
  if (!token) { console.error('FATAL: Login failed'); return; }
  console.log(`  Token: ${token.substring(0,20)}...\n`);

  // Fetch extra catalogs
  console.log('── Extra Catalogs ──');
  
  const frecPago = await soap('FREC', 'ListaFrecuenciaPago', { token });
  console.log('  FrecuenciaPago:', JSON.stringify(frecPago).substring(0, 400));
  
  const formaPago = await soap('FORMA', 'ListaFormaPago', { token });
  console.log('  FormaPago:', JSON.stringify(formaPago).substring(0, 400));
  
  const montoIng = await soap('MONTO', 'ListaMontoIngreso', { token, tipo_persona: 'N' });
  console.log('  MontoIngreso:', JSON.stringify(montoIng).substring(0, 400));

  const origFondo = await soap('FONDO', 'ListaOrigenFondo', { token, tipo_persona: 'N' });
  console.log('  OrigenFondo:', JSON.stringify(origFondo).substring(0, 400));

  const provRes = await soap('PROV', 'ListaProvincia', { token });
  console.log('  Provincias:', JSON.stringify(provRes).substring(0, 400));

  // GuardarCliente — check its WSDL signature and try it
  // From WSDL: GuardarCliente has many required fields including no_cotizacion, tipo_persona, etc.
  
  console.log('');

  // Cotización DT
  console.log('── Estandar (DT 07159) ──');
  const cotRes = await soap('COT', 'Estandar', {
    token,
    cod_marca: '00122', cod_modelo: '10393', ano: '2025',
    suma_asegurada: '0', cod_producto: '07159',
    cedula: '8-888-9999', nombre: 'JUAN', apellido: 'PEREZ',
    vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
    fecha_nac: '16/06/1994', nuevo: '0', responsable: 'CORREDOR',
  });

  let noCot = null;
  if (cotRes?.cotizacion) {
    for (const items of Object.values(cotRes.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCot = it.Descripcion1; break; } }
      }
      if (noCot) break;
    }
  }
  console.log(`  NoCotizacion: ${noCot}\n`);
  if (!noCot) return;

  // Try GuardarCliente before EmitirDatos
  console.log('── GuardarCliente ──');
  const gcRes = await soap('GC', 'GuardarCliente', {
    tipo_persona: 'N',
    cod_producto: '07159',
    pasaporte: '',
    primer_nombre: 'JUAN',
    segundo_nombre: '',
    primer_apellido: 'PEREZ',
    segundo_apellido: '',
    casada: '',
    fecha_nac: '16/06/1994',
    sexo: 'M',
    presidencia: '',
    nacionalidad: 'PANAMÁ',
    direccion_laboral: '',
    calle: 'CALLE 50',
    casa: '1',
    barriada: 'EL CANGREJO',
    corregimiento: 'BELLA VISTA',
    direccion_cobros: 'PANAMA CITY',
    telefono1: '2221133',
    telefono2: '',
    celular: '6000-0001',
    celular2: '',
    email: 'test@test.com',
    apartado: '',
    ced_prov: '8',
    ced_inicial: '888',
    tomo: '9999',
    folio: '',
    asiento: '',
    ocupacion: '001',
    pais_nacimiento: 'PANAMÁ',
    ofondo: '001',
    monto_ingreso: '001',
    prov_residencia: '008',
    cli_forpago: '001',
    cli_frepago: 'M',
    cli_lista: '0',
    cli_fundacion: '',
    cli_pep1: '002',
    asegurado_igual: '1',
    asegurado_benef: '0',
    asegurado_tercero: '0',
    cli_coa: '0',
    dv: '',
    rlegal: '',
    ncomercial: '',
    aoperacion: '',
    cod_actividad: '001',
    cod_clianiocon: '',
    razon_social: '',
    token,
    no_cotizacion: noCot,
    figura: 'contratante',
  });
  console.log('  GuardarCliente:', JSON.stringify(gcRes).substring(0, 500));
  console.log('');

  // Now generate poliza and emit
  console.log('── GenerarNodocumento ──');
  const genRes = await soap('GENDOC', 'GenerarNodocumento', {
    cod_compania: '001', cod_sucursal: '009', ano: '2026',
    cod_ramo: '002', cod_subramo: '001', token,
  });
  const poliza = Array.isArray(genRes) ? genRes[0]?.no_documento : genRes?.no_documento;
  if (!poliza) { console.error('FATAL: No poliza'); return; }
  console.log(`  Póliza: ${poliza}\n`);

  // EmitirDatos with proper codes
  console.log('── EmitirDatos (DT) ──');
  const today = new Date();
  const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  
  const emitRes = await soap('EMIT', 'EmitirDatos', {
    poliza,
    ramo_agt: 'AUTOMOVIL',
    vigencia_inicial: fmtDate(today),
    vigencia_final: fmtDate(ny),
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
    no_chasis: 'JTDKN3DU5A0000003',
    nombre_conductor: 'JUAN',
    apellido_conductor: 'PEREZ',
    sexo_conductor: 'M',
    placa: '000000',
    puertas: '4',
    pasajeros: '5',
    cilindros: '4',
    vin: 'JTDKN3DU5A0000003',
    no_motor: '1NZ0000003',
    ano: '2025',
    direccion: 'PANAMA CITY',
    observacion: 'TEST',
    agencia: '',
    direccion_cobros: 'PANAMA CITY',
    descuento: '0',
    fecha_primer_pago: fmtDate(today),
    cod_agente: COD_AGENTE,
    opcion: 'A',
    no_cotizacion: noCot,
    cod_grupo: '00001',
    nombre_grupo: 'SIN GRUPO',
    token,
    nacionalidad: 'PANAMÁ',
    pep: '002',
    ocupacion: '001',
    profesion: '1',
    pais_residencia: 'PANAMÁ',
    actividad_economica: '001',
    representante_legal: '',
    nombre_comercial: '',
    aviso_operacion: '',
  });
  console.log('  EmitirDatos:', JSON.stringify(emitRes).substring(0, 500));

  // Check
  let ok = false, err = null;
  if (typeof emitRes === 'string') err = emitRes;
  else if (typeof emitRes === 'object' && emitRes) {
    if (emitRes.Respuesta) err = typeof emitRes.Respuesta === 'string' ? emitRes.Respuesta : JSON.stringify(emitRes.Respuesta);
    for (const v of Object.values(emitRes)) { if (Array.isArray(v) && v[0]?.p1 === '0') { ok = true; break; } }
  }
  
  if (ok) {
    console.log('\n🎉 EMISIÓN DT EXITOSA!');
    const pr = await soap('PRINT', 'ImpresionPoliza', { token, no_poliza: poliza });
    console.log('  Print:', JSON.stringify(pr).substring(0, 300));
  } else {
    console.log(`\n❌ FALLIDO: ${err}`);
  }
}

main().catch(e => console.error('Fatal:', e));
