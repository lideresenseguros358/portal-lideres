/**
 * GuardarCliente — CLEAN test with ONLY WSDL-defined params in exact WSDL order.
 * No extra params. Use 'presidencia' for country if needed.
 * Minimal calls: Token → Estandar → GuardarCliente
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Build envelope with params in EXACT order given
function buildEnvelope(method, paramPairs) {
  const xml = paramPairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

async function soap(label, method, paramPairs) {
  const body = buildEnvelope(method, paramPairs);
  const t0 = Date.now();
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
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
  console.log('=== GUARDAR CLIENTE CLEAN TEST ===\n');

  // Token
  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) { console.error('Login failed'); return; }

  // Cotizacion
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

  // GuardarCliente — EXACT WSDL order from GuardarClienteRequest message
  // WSDL params: tipo_persona, cod_producto, pasaporte, primer_nombre, segundo_nombre,
  // primer_apellido, segundo_apellido, casada, fecha_nac, sexo, presidencia, nacionalidad,
  // direccion_laboral, calle, casa, barriada, corregimiento, direccion_cobros, telefono1,
  // telefono2, celular, celular2, email, apartado, ced_prov, ced_inicial, tomo, folio,
  // asiento, ocupacion, pais_nacimiento, ofondo, monto_ingreso, prov_residencia,
  // cli_forpago, cli_frepago, cli_lista, cli_fundacion, cli_pep1, asegurado_igual,
  // asegurado_benef, asegurado_tercero, cli_coa, dv, rlegal, ncomercial, aoperacion,
  // cod_actividad, cod_clianiocon, razon_social, token, no_cotizacion, figura

  console.log('-- Test A: cod_producto=41, figura=1, prov_residencia=008 --');
  await soap('GC-A', 'GuardarCliente', [
    ['tipo_persona', 'N'],
    ['cod_producto', '41'],
    ['pasaporte', ''],
    ['primer_nombre', 'JUAN'],
    ['segundo_nombre', ''],
    ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''],
    ['casada', ''],
    ['fecha_nac', '16/06/1994'],
    ['sexo', 'M'],
    ['presidencia', 'PANAMA'],
    ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA CITY'],
    ['calle', 'CALLE 50'],
    ['casa', '1'],
    ['barriada', 'EL CANGREJO'],
    ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA CITY'],
    ['telefono1', '2221133'],
    ['telefono2', ''],
    ['celular', '60000001'],
    ['celular2', ''],
    ['email', 'test@test.com'],
    ['apartado', ''],
    ['ced_prov', '8'],
    ['ced_inicial', '888'],
    ['tomo', '9999'],
    ['folio', ''],
    ['asiento', ''],
    ['ocupacion', '001'],
    ['pais_nacimiento', 'PANAMA'],
    ['ofondo', '001'],
    ['monto_ingreso', '001'],
    ['prov_residencia', '008'],
    ['cli_forpago', '002'],
    ['cli_frepago', '002'],
    ['cli_lista', '002'],
    ['cli_fundacion', '002'],
    ['cli_pep1', '002'],
    ['asegurado_igual', '001'],
    ['asegurado_benef', '004'],
    ['asegurado_tercero', '006'],
    ['cli_coa', '0'],
    ['dv', ''],
    ['rlegal', ''],
    ['ncomercial', ''],
    ['aoperacion', ''],
    ['cod_actividad', ''],
    ['cod_clianiocon', ''],
    ['razon_social', ''],
    ['token', token],
    ['no_cotizacion', noCot],
    ['figura', '1'],
  ]);

  console.log('\n-- Test B: same but prov_residencia=PANAMA --');
  // Need new cotizacion for new token? No, reuse same token
  await soap('GC-B', 'GuardarCliente', [
    ['tipo_persona', 'N'],
    ['cod_producto', '41'],
    ['pasaporte', ''],
    ['primer_nombre', 'JUAN'],
    ['segundo_nombre', ''],
    ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''],
    ['casada', ''],
    ['fecha_nac', '16/06/1994'],
    ['sexo', 'M'],
    ['presidencia', 'PANAMA'],
    ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA CITY'],
    ['calle', 'CALLE 50'],
    ['casa', '1'],
    ['barriada', 'EL CANGREJO'],
    ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA CITY'],
    ['telefono1', '2221133'],
    ['telefono2', ''],
    ['celular', '60000001'],
    ['celular2', ''],
    ['email', 'test@test.com'],
    ['apartado', ''],
    ['ced_prov', '8'],
    ['ced_inicial', '888'],
    ['tomo', '9999'],
    ['folio', ''],
    ['asiento', ''],
    ['ocupacion', '001'],
    ['pais_nacimiento', 'PANAMA'],
    ['ofondo', '001'],
    ['monto_ingreso', '001'],
    ['prov_residencia', 'PANAMA'],
    ['cli_forpago', '002'],
    ['cli_frepago', '002'],
    ['cli_lista', '002'],
    ['cli_fundacion', '002'],
    ['cli_pep1', '002'],
    ['asegurado_igual', '001'],
    ['asegurado_benef', '004'],
    ['asegurado_tercero', '006'],
    ['cli_coa', '0'],
    ['dv', ''],
    ['rlegal', ''],
    ['ncomercial', ''],
    ['aoperacion', ''],
    ['cod_actividad', ''],
    ['cod_clianiocon', ''],
    ['razon_social', ''],
    ['token', token],
    ['no_cotizacion', noCot],
    ['figura', '1'],
  ]);
}

main().catch(e => console.error('Fatal:', e));
