/**
 * Test GuardarCliente with EXACT values from ANCON documentation (pages 25-26).
 * 
 * Key changes from previous attempts:
 * 1. presidencia = ListaPais value (PANAMÁ with accent)
 * 2. nacionalidad = ListaPais value (PANAMÁ with accent)  
 * 3. pais_nacimiento = ListaPais value (PANAMÁ with accent)
 * 4. es_fumador = "No" (missing in all previous attempts!)
 * 5. All catalog codes from actual API responses
 * 6. no_cotizacion and figura are NOT in the doc's GuardarCliente params list
 *    but we include them since WSDL has them
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

async function main() {
  console.log('=== EXACT DOC VALUES TEST ===\n');

  // 1. Login
  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // 2. Fetch ALL catalogs to use exact values
  console.log('\n--- Fetching ALL catalogs ---');
  const paisData = await soap('ListaPais', 'ListaPais', [['token', token]]);
  const panama = Array.isArray(paisData) ? paisData.find(p => p.nombre?.includes('PANAM')) : null;
  console.log(`  Panama: ${JSON.stringify(panama)}`);
  const PAIS = panama?.nombre || 'PANAMÁ';

  const provData = await soap('ListaProv', 'ListaProvincia', [['token', token]]);
  const provPanama = Array.isArray(provData) ? provData.find(p => p.nombre?.includes('PANAM') && p.cod_provres === '008') : null;
  console.log(`  Provincia Panama: ${JSON.stringify(provPanama)}`);
  const PROV = provPanama?.cod_provres || '008';

  const pepData = await soap('ListaPep', 'ListaPep', [['token', token]]);
  console.log(`  PEP: ${JSON.stringify(pepData).substring(0, 200)}`);

  const ocupData = await soap('ListaOcup', 'ListaOcupacion', [['token', token]]);
  const profData = await soap('ListaProf', 'ListaProfesion', [['token', token]]);
  
  const ofondoData = await soap('ListaOFondo', 'ListaOrigenFondo', [['token', token], ['tipo_persona', 'N']]);
  console.log(`  OrigenFondo: ${JSON.stringify(ofondoData).substring(0, 200)}`);
  
  const mingresoData = await soap('ListaMIngreso', 'ListaMontoIngreso', [['token', token], ['tipo_persona', 'N']]);
  console.log(`  MontoIngreso: ${JSON.stringify(mingresoData).substring(0, 200)}`);

  const forpagoData = await soap('ListaForPago', 'ListaFormaPago', [['token', token]]);
  console.log(`  FormaPago: ${JSON.stringify(forpagoData).substring(0, 200)}`);

  const frepagoData = await soap('ListaFrePago', 'ListaFrecuenciaPago', [['token', token]]);
  console.log(`  FrecPago: ${JSON.stringify(frepagoData).substring(0, 200)}`);

  const negData = await soap('ListaNeg', 'ListaNegativas', [['token', token]]);
  console.log(`  Negativas: ${JSON.stringify(negData).substring(0, 200)}`);

  const ongData = await soap('ListaOng', 'ListaOngFrancas', [['token', token]]);
  console.log(`  OngFrancas: ${JSON.stringify(ongData).substring(0, 200)}`);

  const asegContData = await soap('AsegCont', 'ListaAseguradoContratante', [['token', token]]);
  console.log(`  AseguradoCont: ${JSON.stringify(asegContData).substring(0, 200)}`);

  const benefData = await soap('BenefCont', 'BeneficiarioContratante', [['token', token]]);
  console.log(`  BeneficiarioCont: ${JSON.stringify(benefData).substring(0, 200)}`);

  const tercData = await soap('TercCont', 'TerceroContratante', [['token', token]]);
  console.log(`  TerceroCont: ${JSON.stringify(tercData).substring(0, 200)}`);

  // 3. Cotización
  console.log('\n--- Cotización ---');
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

  // Extract exact catalog codes
  const PEP_NO = Array.isArray(pepData) ? (pepData.find(p => p.nombre?.toLowerCase().includes('no'))?.cod_pep ?? '0') : '0';
  const OCUP = Array.isArray(ocupData) ? ocupData[0]?.cod_ocupacion ?? '001' : '001';
  const OFONDO = Array.isArray(ofondoData) ? ofondoData[0]?.cod_cliorigfon ?? '001' : '001';
  const MINGRESO = Array.isArray(mingresoData) ? mingresoData[0]?.cod_cliorigfon ?? '001' : '001';
  const FORPAGO = Array.isArray(forpagoData) ? forpagoData[0]?.cod_cliformpag ?? '001' : '001';
  const FREPAGO = Array.isArray(frepagoData) ? frepagoData[0]?.cod_valfrecpag ?? '001' : '001';
  const NEG_NO = Array.isArray(negData) ? (negData.find(p => p.nombre?.trim().toLowerCase() === 'no')?.cod_lista_negativa ?? '002|campo_lista_neg') : '002|campo_lista_neg';
  const ONG_NO = Array.isArray(ongData) ? (ongData.find(p => p.nombre?.trim().toLowerCase() === 'no')?.cod_lista_franca ?? '002|campo_fundongzon') : '002|campo_fundongzon';
  const PEP_NO_CODE = Array.isArray(pepData) ? (pepData.find(p => p.nombre?.trim().toLowerCase() === 'no')?.cod_pep ?? '0') : '0';
  const ASEG_SI = Array.isArray(asegContData) ? (asegContData.find(p => p.nombre?.trim().toLowerCase() === 'si')?.cod_clicontrol ?? '001') : '001';
  const BENEF_NO = Array.isArray(benefData) ? (benefData.find(p => p.nombre?.trim().toLowerCase() === 'no')?.cod_clicontrol ?? '005') : '005';
  const TERC_NO = Array.isArray(tercData) ? (tercData.find(p => p.nombre?.trim().toLowerCase() === 'no')?.cod_clicontrol ?? '006') : '006';

  console.log(`\nUsing exact values:`);
  console.log(`  PAIS=${PAIS}, PROV=${PROV}`);
  console.log(`  PEP=${PEP_NO_CODE}, OCUP=${OCUP}, OFONDO=${OFONDO}, MINGRESO=${MINGRESO}`);
  console.log(`  FORPAGO=${FORPAGO}, FREPAGO=${FREPAGO}`);
  console.log(`  NEG=${NEG_NO}, ONG=${ONG_NO}`);
  console.log(`  ASEG_SI=${ASEG_SI}, BENEF_NO=${BENEF_NO}, TERC_NO=${TERC_NO}`);

  // 4. GuardarCliente — Test A: with accented PANAMÁ + es_fumador
  console.log('\n--- Test A: EXACT doc values (with accents + es_fumador) ---');
  const gcA = await soap('GC-A', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', PAIS], ['nacionalidad', PAIS],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', OCUP], ['pais_nacimiento', PAIS],
    ['ofondo', OFONDO], ['monto_ingreso', MINGRESO], ['prov_residencia', PROV],
    ['cli_forpago', FORPAGO], ['cli_frepago', FREPAGO],
    ['cli_lista', NEG_NO], ['cli_fundacion', ONG_NO],
    ['cli_pep1', PEP_NO_CODE + '|campo_pep'],
    ['asegurado_igual', ASEG_SI], ['asegurado_benef', BENEF_NO], ['asegurado_tercero', TERC_NO],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['es_fumador', 'No'],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // 5. Test B: same but WITHOUT accents (PANAMA instead of PANAMÁ)
  console.log('\n--- Test B: without accents ---');
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
    ['folio', ''], ['asiento', ''], ['ocupacion', OCUP], ['pais_nacimiento', 'PANAMA'],
    ['ofondo', OFONDO], ['monto_ingreso', MINGRESO], ['prov_residencia', PROV],
    ['cli_forpago', FORPAGO], ['cli_frepago', FREPAGO],
    ['cli_lista', NEG_NO], ['cli_fundacion', ONG_NO],
    ['cli_pep1', PEP_NO_CODE + '|campo_pep'],
    ['asegurado_igual', ASEG_SI], ['asegurado_benef', BENEF_NO], ['asegurado_tercero', TERC_NO],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['es_fumador', 'No'],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // 6. Test C: cli_pep1 format — try just the code, not pipe format
  console.log('\n--- Test C: cli_pep1 as just code (0) ---');
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
    ['folio', ''], ['asiento', ''], ['ocupacion', OCUP], ['pais_nacimiento', 'PANAMA'],
    ['ofondo', OFONDO], ['monto_ingreso', MINGRESO], ['prov_residencia', PROV],
    ['cli_forpago', FORPAGO], ['cli_frepago', FREPAGO],
    ['cli_lista', NEG_NO], ['cli_fundacion', ONG_NO],
    ['cli_pep1', PEP_NO_CODE],
    ['asegurado_igual', ASEG_SI], ['asegurado_benef', BENEF_NO], ['asegurado_tercero', TERC_NO],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['es_fumador', 'No'],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // Check which tests succeeded
  for (const [label, result] of [['A', gcA], ['B', gcB], ['C', gcC]]) {
    const msg = Array.isArray(result) ? result[0]?.Mensaje : '';
    const code = Array.isArray(result) ? result[0]?.cod_cliente : '';
    console.log(`\n  Test ${label}: cod_cliente=${code}, Mensaje="${msg}"`);
    if (msg && msg.includes('exitosa')) {
      console.log(`  *** TEST ${label} SUCCEEDED! ***`);
    }
  }
}

main().catch(e => console.error('Fatal:', e));
