/**
 * GuardarCliente — Test POSITIONAL insertion of pais_residencia
 * 
 * Hypothesis: NuSOAP PHP might accept extra params if placed at a specific position.
 * The server code likely reads params in order and expects pais_residencia right after
 * prov_residencia (position 34 in WSDL).
 * 
 * Also test: maybe `es_fumador` goes right after `razon_social` (position 51).
 * 
 * Test different SOAP encoding styles to see if named params bypass the WSDL validation.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

async function rawSoapCustom(label, body, soapAction) {
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction }, body });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 600);
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 400)}`);
  return parsed;
}

function bldSimple(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}

async function soap(label, method, pairs) {
  return rawSoapCustom(label, bldSimple(method, pairs), `urn:server_otros#${method}`);
}

async function main() {
  console.log('=== GC POSITIONAL tests ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // Get cotización
  const cr = await soap('COT', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '0'], ['cod_producto', '07159'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]);
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

  // WSDL param order (52 params):
  // 0-tipo_persona, 1-cod_producto, 2-pasaporte, 3-primer_nombre, 4-segundo_nombre,
  // 5-primer_apellido, 6-segundo_apellido, 7-casada, 8-fecha_nac, 9-sexo, 
  // 10-presidencia, 11-nacionalidad,
  // 12-direccion_laboral, 13-calle, 14-casa, 15-barriada, 16-corregimiento,
  // 17-direccion_cobros, 18-telefono1, 19-telefono2, 20-celular, 21-celular2, 
  // 22-email, 23-apartado,
  // 24-ced_prov, 25-ced_inicial, 26-tomo, 27-folio, 28-asiento, 
  // 29-ocupacion, 30-pais_nacimiento,
  // 31-ofondo, 32-monto_ingreso, 33-prov_residencia,
  // 34-cli_forpago, 35-cli_frepago, 36-cli_lista,
  // 37-cli_fundacion, 38-cli_pep1, 39-asegurado_igual, 40-asegurado_benef, 
  // 41-asegurado_tercero, 42-cli_coa, 43-dv, 44-rlegal, 45-ncomercial, 
  // 46-aoperacion, 47-cod_actividad, 48-cod_clianiocon, 49-razon_social, 
  // 50-token, 51-no_cotizacion, 52-figura

  // TEST 1: pais_residencia RIGHT AFTER prov_residencia (position 34)
  console.log('--- Test 1: pais_residencia after prov_residencia (pos 34) ---');
  const pairs1 = [
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
    ['pais_residencia', 'PANAMA'],  // <<< INSERTED HERE between prov_residencia and cli_forpago
    ['cli_forpago', '002'], ['cli_frepago', '002'], ['cli_lista', '002'],
    ['cli_fundacion', '002'], ['cli_pep1', '002'], ['asegurado_igual', '001'],
    ['asegurado_benef', '004'], ['asegurado_tercero', '006'], ['cli_coa', '0'],
    ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ];
  await soap('GC-1', 'GuardarCliente', pairs1);

  // TEST 2: Same but with RPC/encoded SOAP envelope style (NuSOAP native)
  console.log('\n--- Test 2: pais_residencia after prov_residencia + RPC/encoded ---');
  const xml2 = pairs1.map(([k,v]) => `<${k} xsi:type="xsd:string">${esc(String(v ?? ''))}</${k}>`).join('');
  const env2 = `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" xmlns:tns="urn:server_otros"><SOAP-ENV:Body><tns:GuardarCliente SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">${xml2}</tns:GuardarCliente></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
  await rawSoapCustom('GC-2', env2, 'urn:server_otros#GuardarCliente');

  // TEST 3: Same position but with es_fumador after razon_social
  console.log('\n--- Test 3: pais_residencia + es_fumador, RPC/encoded ---');
  const pairs3 = [
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
  const xml3 = pairs3.map(([k,v]) => `<${k} xsi:type="xsd:string">${esc(String(v ?? ''))}</${k}>`).join('');
  const env3 = `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" xmlns:tns="urn:server_otros"><SOAP-ENV:Body><tns:GuardarCliente SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">${xml3}</tns:GuardarCliente></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
  await rawSoapCustom('GC-3', env3, 'urn:server_otros#GuardarCliente');

  // TEST 4: Try WITHOUT namespace prefix on method (bare method name)
  console.log('\n--- Test 4: Bare method (no namespace prefix) + pais_residencia ---');
  const xml4 = pairs1.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  const env4 = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GuardarCliente>${xml4}</GuardarCliente></soap:Body></soap:Envelope>`;
  await rawSoapCustom('GC-4', env4, 'urn:server_otros#GuardarCliente');

  // TEST 5: Use urn:emision namespace with pais_residencia after prov_residencia
  console.log('\n--- Test 5: urn:emision namespace + pais_residencia ---');
  const xml5 = pairs1.map(([k,v]) => `<${k} xsi:type="xsd:string">${esc(String(v ?? ''))}</${k}>`).join('');
  const env5 = `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" xmlns:tns="urn:emision"><SOAP-ENV:Body><tns:GuardarCliente SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">${xml5}</tns:GuardarCliente></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
  await rawSoapCustom('GC-5', env5, 'urn:server_otros#GuardarCliente');

  // TEST 6: What if we use document/literal instead of RPC/encoded? 
  // In doc/literal, params are matched by name not position, so extra params might be tolerated
  console.log('\n--- Test 6: Document/literal style + pais_residencia ---');
  const xml6 = pairs1.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  const env6 = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soap:Body><GuardarCliente xmlns="urn:emision">${xml6}</GuardarCliente></soap:Body></soap:Envelope>`;
  await rawSoapCustom('GC-6', env6, 'urn:emision#GuardarCliente');
}

main().catch(e => console.error('Fatal:', e));
