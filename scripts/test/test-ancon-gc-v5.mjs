/**
 * GuardarCliente v5 — Try urn:emision namespace with RPC/encoded style
 * Also try: raw SOAP without namespace prefix for params (PHP NuSOAP may be flexible)
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Standard envelope (urn:server_otros)
function envStd(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}

// urn:emision envelope with xsi:type annotations (RPC/encoded)
function envEmision(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k} xsi:type="xsd:string">${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:tns="urn:emision"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}

// No namespace prefix on method (bare)
function envBare(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method} xmlns="urn:emision">${xml}</${method}></soap:Body></soap:Envelope>`;
}

function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

async function soapRaw(label, envelope, soapAction) {
  const t0 = Date.now();
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction }, body: envelope });
  const text = await res.text();
  const elapsed = Date.now() - t0;
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`[${label}] (${elapsed}ms) -> ${JSON.stringify(parsed).substring(0, 400)}`);
  return parsed;
}

async function main() {
  console.log('=== GC v5: Different envelope styles ===\n');

  const lr = await soapRaw('LOGIN', envStd('GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]), 'urn:server_otros#GenerarToken');
  const token = lr?.Login?.[0]?.Token;
  if (!token) { console.error('Login failed'); return; }

  const cr = await soapRaw('COT', envStd('Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '0'], ['cod_producto', '07159'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]), 'urn:server_otros#Estandar');
  let noCot = null;
  if (cr?.cotizacion) {
    for (const items of Object.values(cr.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCot = it.Descripcion1; break; } }
      }
      if (noCot) break;
    }
  }
  console.log(`NoCot: ${noCot}\n`);
  if (!noCot) return;

  // Full param list matching doc page 25-26 order (with pais_residencia and es_fumador)
  const gcParams = [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMA'], ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA CITY'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA CITY'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMA'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '008'],
    ['pais_residencia', 'PANAMA'],
    ['cli_forpago', '002'], ['cli_frepago', '002'], ['cli_lista', '002'],
    ['cli_fundacion', '002'], ['cli_pep1', '002'], ['asegurado_igual', '001'],
    ['asegurado_benef', '004'], ['asegurado_tercero', '006'], ['cli_coa', '0'],
    ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['es_fumador', 'No'],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ];

  // Test 1: urn:emision namespace with RPC encoded
  console.log('-- Test 1: urn:emision + xsi:type + SOAPAction=urn:emision#GuardarCliente --');
  await soapRaw('GC-emision', envEmision('GuardarCliente', gcParams), 'urn:emision#GuardarCliente');

  // Test 2: urn:emision namespace but SOAPAction urn:server_otros
  console.log('\n-- Test 2: urn:emision + SOAPAction urn:server_otros --');
  await soapRaw('GC-emi-old', envEmision('GuardarCliente', gcParams), 'urn:server_otros#GuardarCliente');

  // Test 3: bare namespace
  console.log('\n-- Test 3: bare namespace --');
  await soapRaw('GC-bare', envBare('GuardarCliente', gcParams), 'urn:emision#GuardarCliente');
}

main().catch(e => console.error('Fatal:', e));
