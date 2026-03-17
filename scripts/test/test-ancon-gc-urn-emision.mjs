/**
 * GuardarCliente — Use urn:emision namespace instead of urn:server_otros
 * The WSDL defines targetNamespace="urn:emision" but we've been using urn:server_otros.
 * Maybe urn:emision has an updated param list that includes pais_residencia.
 * 
 * CRITICAL INSIGHT: The WSDL targetNamespace is "urn:emision" not "urn:server_otros"!
 * We've been using the wrong namespace for ALL calls and it worked for most methods,
 * but GuardarCliente might be stricter.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Build with urn:emision namespace (matching WSDL targetNamespace)
function bldEmision(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k} xsi:type="xsd:string">${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" xmlns:tns="urn:emision"><SOAP-ENV:Body><tns:${method} xmlns:tns="urn:emision" SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">${xml}</tns:${method}></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
}

// Original urn:server_otros
function bldOtros(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}

function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&#039;/g,"'"); }

async function soapRaw(label, envelope, soapAction) {
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction }, body: envelope });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 400)}`);
  return parsed;
}

async function main() {
  console.log('=== GC with urn:emision namespace ===\n');

  // Login with standard namespace (works fine)
  const lr = await soapRaw('LOGIN', bldOtros('GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]), 'urn:server_otros#GenerarToken');
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // Cotización with standard namespace
  const cr = await soapRaw('COT', bldOtros('Estandar', [
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

  // GuardarCliente with WSDL params + pais_residencia using urn:emision
  // The WSDL targetNamespace is urn:emision and binds with RPC/encoded
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
    ['pais_residencia', 'PANAMA'],  // extra param NOT in WSDL
    ['cli_forpago', '002'], ['cli_frepago', '002'], ['cli_lista', '002'],
    ['cli_fundacion', '002'], ['cli_pep1', '002'], ['asegurado_igual', '001'],
    ['asegurado_benef', '004'], ['asegurado_tercero', '006'], ['cli_coa', '0'],
    ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['es_fumador', 'No'],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ];

  // Test 1: urn:emision with RPC/encoded style + SOAPAction urn:emision#GuardarCliente
  console.log('--- Test 1: urn:emision + SOAPAction urn:emision#GC ---');
  await soapRaw('GC-1', bldEmision('GuardarCliente', gcParams), 'urn:emision#GuardarCliente');

  // Test 2: urn:emision with SOAPAction urn:server_otros#GuardarCliente  
  console.log('\n--- Test 2: urn:emision + SOAPAction urn:server_otros#GC ---');
  await soapRaw('GC-2', bldEmision('GuardarCliente', gcParams), 'urn:server_otros#GuardarCliente');

  // Test 3: WITHOUT pais_residencia or es_fumador, just WSDL params, urn:emision
  console.log('\n--- Test 3: urn:emision, WSDL-only params ---');
  const gcWsdlOnly = [
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
    ['cli_forpago', '002'], ['cli_frepago', '002'], ['cli_lista', '002'],
    ['cli_fundacion', '002'], ['cli_pep1', '002'], ['asegurado_igual', '001'],
    ['asegurado_benef', '004'], ['asegurado_tercero', '006'], ['cli_coa', '0'],
    ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ];
  await soapRaw('GC-3', bldEmision('GuardarCliente', gcWsdlOnly), 'urn:emision#GuardarCliente');

  // Test 4: urn:server_otros + xsi:type (encoded style)
  console.log('\n--- Test 4: urn:server_otros + xsi:type ---');
  function bldOtrosEncoded(method, pairs) {
    const xml = pairs.map(([k,v]) => `<${k} xsi:type="xsd:string">${esc(String(v ?? ''))}</${k}>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:tns="urn:server_otros"><SOAP-ENV:Body><tns:${method}>${xml}</tns:${method}></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
  }
  await soapRaw('GC-4', bldOtrosEncoded('GuardarCliente', gcWsdlOnly), 'urn:server_otros#GuardarCliente');
}

main().catch(e => console.error('Fatal:', e));
