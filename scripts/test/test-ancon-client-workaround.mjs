/**
 * Workaround: GuardarCliente needs pais_residencia which isn't in WSDL.
 * 
 * Theory: the "PAÍS DE RESIDENCIA es obligatorio" error might come from 
 * prov_residencia being empty or wrong format. The field prov_residencia 
 * might actually expect country name for persona Natural.
 * 
 * Also: ConsultarCliente to check if cedula 8-888-9999 already exists.
 * 
 * New approach: Send GuardarCliente with prov_residencia='PANAMA' (as country name)
 * instead of province code '008'.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function bld(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

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
  console.log('=== CLIENT WORKAROUND ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

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
  console.log(`NoCot: ${noCot}\n`);
  if (!noCot) return;

  // ConsultarCliente — check if this cedula has a client in ANCON
  console.log('-- ConsultarCliente --');
  await soap('CC-contr', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCot], ['figura', 'contratante']]);
  await soap('CC-aseg', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCot], ['figura', 'asegurado']]);
  await soap('CC-1', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCot], ['figura', '1']]);

  // GuardarCliente — WSDL-only params, prov_residencia='PANAMA' as country name
  console.log('\n-- GC: prov_residencia=PANAMA (country name, no accent) --');
  const gc1 = await soap('GC-1', 'GuardarCliente', [
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
    ['ofondo', '001'], ['monto_ingreso', '001'],
    ['prov_residencia', 'PANAMA'],   // <-- try as country name
    ['cli_forpago', '002'], ['cli_frepago', '002'], ['cli_lista', '002'],
    ['cli_fundacion', '002'], ['cli_pep1', '002'], ['asegurado_igual', '001'],
    ['asegurado_benef', '004'], ['asegurado_tercero', '006'], ['cli_coa', '0'],
    ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // GC-2: Try with NO cod_producto (empty) since '41' might not exist for us
  console.log('\n-- GC: cod_producto="" --');
  const gc2 = await soap('GC-2', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', ''], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMA'], ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA CITY'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA CITY'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMA'],
    ['ofondo', '001'], ['monto_ingreso', '001'],
    ['prov_residencia', '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'], ['cli_lista', '002'],
    ['cli_fundacion', '002'], ['cli_pep1', '002'], ['asegurado_igual', '001'],
    ['asegurado_benef', '004'], ['asegurado_tercero', '006'], ['cli_coa', '0'],
    ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // Check results
  for (const [name, gc] of [['GC-1', gc1], ['GC-2', gc2]]) {
    if (Array.isArray(gc) && gc[0]?.Mensaje) {
      const ok = gc[0].Mensaje.toLowerCase().includes('exitosa');
      console.log(`\n${name}: ${ok ? 'SUCCESS' : gc[0].Mensaje}`);
    }
  }
}

main().catch(e => console.error('Fatal:', e));
