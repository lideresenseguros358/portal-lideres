/**
 * GuardarCliente v6 — Test prov_residencia with accented PANAMÁ
 * Theory: prov_residencia IS the country field, and it needs the accented name
 * from ListaPais catalog. The "PAÍS DE RESIDENCIA" error refers to this field.
 * 
 * ALSO: Look at ListaProvincia catalog to see what format it returns.
 * ALSO: Try GuardarCliente with ONLY WSDL params, using PANAMÁ (accented) in prov_residencia
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function bld(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&#039;/g,"'").replace(/&ntilde;/g,'ñ').replace(/&oacute;/g,'ó').replace(/&aacute;/g,'á').replace(/&eacute;/g,'é').replace(/&iacute;/g,'í').replace(/&uacute;/g,'ú'); }

async function soap(label, method, pairs) {
  const body = bld(method, pairs);
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 400)}`);
  return parsed;
}

async function main() {
  console.log('=== GC v6: prov_residencia with accent ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // Fetch ListaProvincia to understand expected format
  console.log('--- ListaProvincia ---');
  const prov = await soap('PROV', 'ListaProvincia', [['token', token]]);
  if (Array.isArray(prov)) {
    console.log('  All provinces:');
    for (const p of prov) console.log(`    ${JSON.stringify(p)}`);
  }

  // Fetch ListaPais for comparison
  console.log('\n--- ListaPais (first 5) ---');
  const pais = await soap('PAIS', 'ListaPais', [['token', token]]);
  if (Array.isArray(pais)) {
    const panama = pais.find(p => p.nombre?.includes('PANAM'));
    console.log('  PANAMA entry:', JSON.stringify(panama));
    // Look for cod_paisres or any code field
    const first = pais[0];
    console.log('  First entry keys:', Object.keys(first));
    console.log('  First 3:', pais.slice(0,3).map(p => JSON.stringify(p)).join('\n    '));
  }

  // Cotización
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
  console.log(`\nNoCot: ${noCot}\n`);
  if (!noCot) return;

  // Test A: prov_residencia = 'PANAMÁ' (with accent, from ListaPais)
  console.log('--- GC-A: prov_residencia=PANAMÁ (accented) ---');
  await soap('GC-A', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMÁ'], ['nacionalidad', 'PANAMÁ'],
    ['direccion_laboral', 'PANAMA CITY'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA CITY'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMÁ'],
    ['ofondo', '001'], ['monto_ingreso', '001'],
    ['prov_residencia', 'PANAMÁ'],  // accented country name
    ['cli_forpago', '002'], ['cli_frepago', '002'], ['cli_lista', '002'],
    ['cli_fundacion', '002'], ['cli_pep1', '002'], ['asegurado_igual', '001'],
    ['asegurado_benef', '004'], ['asegurado_tercero', '006'], ['cli_coa', '0'],
    ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // Test B: use province code from catalog if available
  if (Array.isArray(prov) && prov.length > 0) {
    const provPanama = prov.find(p => p.nombre?.includes('PANAM'));
    if (provPanama) {
      const provCode = provPanama.cod_provres || Object.values(provPanama)[0];
      console.log(`\n--- GC-B: prov_residencia='${provCode}' (from ListaProvincia) ---`);
      await soap('GC-B', 'GuardarCliente', [
        ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
        ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
        ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
        ['presidencia', 'PANAMÁ'], ['nacionalidad', 'PANAMÁ'],
        ['direccion_laboral', 'PANAMA CITY'], ['calle', 'CALLE 50'], ['casa', '1'],
        ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
        ['direccion_cobros', 'PANAMA CITY'], ['telefono1', '2221133'], ['telefono2', ''],
        ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
        ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
        ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMÁ'],
        ['ofondo', '001'], ['monto_ingreso', '001'],
        ['prov_residencia', provCode],
        ['cli_forpago', '002'], ['cli_frepago', '002'], ['cli_lista', '002'],
        ['cli_fundacion', '002'], ['cli_pep1', '002'], ['asegurado_igual', '001'],
        ['asegurado_benef', '004'], ['asegurado_tercero', '006'], ['cli_coa', '0'],
        ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
        ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
        ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
      ]);
    }
  }
}

main().catch(e => console.error('Fatal:', e));
