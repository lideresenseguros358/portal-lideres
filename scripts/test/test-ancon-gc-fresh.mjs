/**
 * GuardarCliente with FRESH token — minimal calls before GC.
 * Previous test failed with "Token Inactivo" because too many catalog calls consumed the token.
 * 
 * Using known values from catalogs (already fetched):
 * - ListaPais: PANAMÁ (with accent)
 * - ListaProvincia: cod_provres=008 (PANAMÁ)
 * - ListaOcupacion: cod_ocupacion=001 (CONTADOR)
 * - ListaOrigenFondo: cod_cliorigfon=001 (Asalariado)
 * - ListaMontoIngreso: cod_cliperfing=001 (Menor a 10,000) — NOTE: key is cod_cliperfing, not cod_cliorigfon!
 * - ListaFormaPago: cod_cliformpag=002 (Tarjeta de Crédito)
 * - ListaFrecuenciaPago: cod_valfrecpag=002 (CADA 30 DIAS)
 * - ListaNegativas: 002|campo_lista_neg (NO)
 * - ListaOngFrancas: 002|campo_fundongzon (NO)
 * - ListaPep: cod_pep=0 (NO) — but pipe format in GC is "002|campo_pep"
 * - ListaAseguradoContratante: cod_clicontrol=001 (SI)
 * - BeneficiarioContratante: cod_clicontrol=005 (NO)
 * - TerceroContratante: cod_clicontrol=006 (NO)
 * - es_fumador: "No"
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

async function soap(label, method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 600)}`);
  return parsed;
}

async function getToken() {
  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  return lr?.Login?.[0]?.Token;
}

async function main() {
  console.log('=== FRESH TOKEN GC TESTS ===\n');

  // Test A: Fresh token → Estandar → GuardarCliente (with accents)
  console.log('--- Test A: PANAMÁ (with accent), es_fumador=No ---');
  let token = await getToken();
  if (!token) return;

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
  console.log(`NoCot: ${noCot}`);
  if (!noCot) return;

  // GC with PANAMÁ (accent) — fresh token, only 2 calls used so far
  const gcA = await soap('GC-A', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAM\u00c1'], ['nacionalidad', 'PANAM\u00c1'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAM\u00c1'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['es_fumador', 'No'],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);
  console.log('Result A:', JSON.stringify(gcA));

  // Test B: Fresh token → same but WITHOUT accents
  console.log('\n--- Test B: PANAMA (no accent), es_fumador=No ---');
  token = await getToken();
  const cr2 = await soap('COT2', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '0'], ['cod_producto', '07159'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]);
  let noCot2 = null;
  if (cr2?.cotizacion) {
    for (const items of Object.values(cr2.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCot2 = it.Descripcion1; break; } }
      }
      if (noCot2) break;
    }
  }
  console.log(`NoCot2: ${noCot2}`);

  const gcB = await soap('GC-B', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMA'], ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMA'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['es_fumador', 'No'],
    ['token', token], ['no_cotizacion', noCot2], ['figura', '1'],
  ]);
  console.log('Result B:', JSON.stringify(gcB));

  // Test C: Fresh token → WITHOUT es_fumador (to isolate the effect)
  console.log('\n--- Test C: PANAMA (no accent), NO es_fumador ---');
  token = await getToken();
  const cr3 = await soap('COT3', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '0'], ['cod_producto', '07159'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]);
  let noCot3 = null;
  if (cr3?.cotizacion) {
    for (const items of Object.values(cr3.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCot3 = it.Descripcion1; break; } }
      }
      if (noCot3) break;
    }
  }

  const gcC = await soap('GC-C', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMA'], ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMA'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot3], ['figura', '1'],
  ]);
  console.log('Result C:', JSON.stringify(gcC));
}

main().catch(e => console.error('Fatal:', e));
