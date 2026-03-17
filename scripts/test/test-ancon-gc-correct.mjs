/**
 * GuardarCliente — FULLY WSDL-CORRECT attempt
 * 
 * Key fixes:
 * 1. Use urn:emision namespace (WSDL targetNamespace)
 * 2. Use SOAPAction: urn:emision#GuardarCliente (from WSDL binding)
 * 3. Use RPC/encoded style with xsi:type (from WSDL binding)
 * 4. Fetch ListaOrigenFondo with tipo_persona='N' (WSDL requires it!)
 * 5. Fetch ListaMontoIngreso with tipo_persona='N'
 * 6. Also fetch ListaAseguradoContratante, TipoIdentificacion, ListaNegativas
 * 7. Use ONLY WSDL params — NO extras
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

// Build WSDL-correct RPC/encoded envelope with urn:emision namespace
function bldCorrect(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k} xsi:type="xsd:string">${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" xmlns:tns="urn:emision"><SOAP-ENV:Body><tns:${method} SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">${xml}</tns:${method}></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
}

// Simple envelope (what we've been using — works for most methods)
function bldSimple(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}

async function soapSimple(label, method, pairs) {
  return rawSoap(label, bldSimple(method, pairs), `urn:server_otros#${method}`);
}

async function soapCorrect(label, method, pairs) {
  return rawSoap(label, bldCorrect(method, pairs), `urn:emision#${method}`);
}

async function rawSoap(label, body, soapAction) {
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction }, body });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 600);
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 500)}`);
  return parsed;
}

async function main() {
  console.log('=== GC FULLY WSDL-CORRECT ===\n');

  // Login (simple works fine)
  const lr = await soapSimple('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // ===== Step 1: Fetch ALL catalogs correctly =====
  console.log('\n--- Fetching catalogs with correct params ---');
  
  // ListaOrigenFondo needs tipo_persona!
  const ofondo = await soapSimple('OrigenFondo(N)', 'ListaOrigenFondo', [['token', token], ['tipo_persona', 'N']]);
  const monto = await soapSimple('MontoIngreso(N)', 'ListaMontoIngreso', [['token', token], ['tipo_persona', 'N']]);
  
  // Other catalogs we haven't tried
  const asegCont = await soapSimple('AsegContratante', 'ListaAseguradoContratante', [['token', token]]);
  const tercero = await soapSimple('TerceroContratante', 'TerceroContratante', [['token', token]]);
  const benef = await soapSimple('BenefContratante', 'BeneficiarioContratante', [['token', token]]);
  const tipoIdent = await soapSimple('TipoIdentificacion', 'TipoIdentificacion', [['token', token]]);
  const anioConst = await soapSimple('AnioConstitucion', 'ListaAnioConstitucion', [['token', token]]);
  const negativas = await soapSimple('Negativas', 'ListaNegativas', [['token', token]]);
  const ongFrancas = await soapSimple('OngFrancas', 'ListaOngFrancas', [['token', token]]);
  
  // Existing catalogs for reference
  const pep = await soapSimple('PEP', 'ListaPep', [['token', token]]);
  const ocupacion = await soapSimple('Ocupacion', 'ListaOcupacion', [['token', token]]);
  const profesion = await soapSimple('Profesion', 'ListaProfesion', [['token', token]]);

  // Print first few items from each
  if (Array.isArray(ofondo)) console.log('  OrigenFondo keys:', Object.keys(ofondo[0]), 'first:', JSON.stringify(ofondo[0]));
  if (Array.isArray(monto)) console.log('  MontoIngreso keys:', Object.keys(monto[0]), 'first:', JSON.stringify(monto[0]));
  if (Array.isArray(asegCont)) console.log('  AsegContratante first:', JSON.stringify(asegCont[0]));
  if (Array.isArray(tercero)) console.log('  TerceroContratante first:', JSON.stringify(tercero[0]));
  if (Array.isArray(benef)) console.log('  BenefContratante first:', JSON.stringify(benef[0]));
  if (Array.isArray(tipoIdent)) console.log('  TipoIdentificacion first:', JSON.stringify(tipoIdent[0]));
  if (Array.isArray(negativas)) console.log('  Negativas first:', JSON.stringify(negativas[0]));
  if (Array.isArray(ongFrancas)) console.log('  OngFrancas first:', JSON.stringify(ongFrancas[0]));

  // ===== Step 2: Create cotización =====
  console.log('\n--- Cotización ---');
  const cr = await soapSimple('COT', 'Estandar', [
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

  // ===== Step 3: GuardarCliente with WSDL-correct envelope and correct catalog codes =====
  console.log('\n--- GuardarCliente: WSDL-correct envelope, urn:emision ---');
  
  // Use real catalog codes if available
  const ofondoCode = Array.isArray(ofondo) ? (ofondo[0]?.cod_origfondo || ofondo[0]?.codigo || Object.values(ofondo[0])[0]) : '001';
  const montoCode = Array.isArray(monto) ? (monto[0]?.cod_valmonting || monto[0]?.codigo || Object.values(monto[0])[0]) : '001';
  const asegIgualCode = Array.isArray(asegCont) ? (asegCont[0]?.codigo || Object.values(asegCont[0])[0]) : '001';
  
  console.log(`  Using ofondo=${ofondoCode}, monto=${montoCode}, asegIgual=${asegIgualCode}`);

  // WSDL-ONLY params in EXACT WSDL order (52 params)
  const gcPairs = [
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
    ['ofondo', String(ofondoCode)], ['monto_ingreso', String(montoCode)], 
    ['prov_residencia', '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'], ['cli_lista', '002'],
    ['cli_fundacion', '002'], ['cli_pep1', '002'], ['asegurado_igual', '001'],
    ['asegurado_benef', '004'], ['asegurado_tercero', '006'], ['cli_coa', '0'],
    ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ];

  // Test A: WSDL-correct RPC/encoded with urn:emision (matching WSDL binding exactly)
  console.log('\n  Test A: urn:emision + RPC/encoded + SOAPAction urn:emision#GC');
  await soapCorrect('GC-A', 'GuardarCliente', gcPairs);

  // Test B: Same but SOAPAction urn:server_otros (in case the server routes by this)
  console.log('\n  Test B: urn:emision + RPC/encoded + SOAPAction urn:server_otros#GC');
  await rawSoap('GC-B', bldCorrect('GuardarCliente', gcPairs), 'urn:server_otros#GuardarCliente');

  // Test C: Simple envelope (what's been working for other methods)
  console.log('\n  Test C: urn:server_otros simple (baseline)');
  await soapSimple('GC-C', 'GuardarCliente', gcPairs);

  // ===== Step 4: Try skipping GuardarCliente and go straight to EmitirDatos =====
  // Maybe GuardarCliente is NOT required for DT — let's focus on fixing EmitirDatos directly
  // The FK error might be from something else entirely
  console.log('\n\n===== SKIP GuardarCliente — try EmitirDatos directly =====');
  console.log('Hypothesis: Maybe the FK is from cod_grupo (ListadoGrupos returns null for us)');
  console.log('Or from invalid compliance codes\n');
  
  // Gen doc
  const gen = await soapSimple('GEN', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
  if (!pol) { console.log('No poliza'); return; }

  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const fmtDate = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const vin = 'LJ11KB' + Date.now().toString(36).toUpperCase();

  // Get valid catalog values for EmitirDatos compliance fields
  const pepCode = Array.isArray(pep) ? pep[1]?.codigo || '002|campo_pep' : '002|campo_pep'; // NO
  const ocuCode = Array.isArray(ocupacion) ? ocupacion[0]?.codigo || '001' : '001';
  const profCode = Array.isArray(profesion) ? profesion[0]?.codigo || '1' : '1';
  
  console.log(`  PEP=${pepCode}, Ocupacion=${ocuCode}, Profesion=${profCode}`);

  // EmitirDatos Test A: with compliance fields EMPTY (maybe they're optional for DT?)
  console.log('\n--- EmitirDatos A: ALL compliance fields EMPTY ---');
  await soapSimple('EMIT-A', 'EmitirDatos', [
    ['poliza', pol], ['ramo_agt', 'AUTOMOVIL'],
    ['vigencia_inicial', fmtDate(today)], ['vigencia_final', fmtDate(ny)],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['apellido_casada', ''], ['tipo_de_cliente', 'N'],
    ['cedula', '8-888-9999'], ['pasaporte', ''], ['ruc', ''],
    ['fecha_nacimiento', '16/06/1994'], ['sexo', 'M'],
    ['telefono_Residencial', '2221133'], ['telefono_oficina', ''],
    ['telefono_celular', '60000001'], ['email', 'test@test.com'],
    ['tipo', 'POLIZA'], ['fecha_de_registro', fmtDate(today)],
    ['cantidad_de_pago', '10'], ['codigo_producto_agt', '07159'],
    ['nombre_producto', 'WEB - AUTORC'], ['Responsable_de_cobro', 'CORREDOR'],
    ['suma_asegurada', '0'], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
    ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
    ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
    ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
    ['no_chasis', vin], ['nombre_conductor', 'JUAN'],
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', ''],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', vin], ['no_motor', 'M' + vin], ['ano', '2025'],
    ['direccion', 'PANAMA'], ['observacion', ''], ['agencia', ''],
    ['direccion_cobros', 'PANAMA'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', ''], ['nombre_grupo', ''], ['token', token],
    ['nacionalidad', ''], ['pep', ''],
    ['ocupacion', ''], ['profesion', ''],
    ['pais_residencia', ''], ['actividad_economica', ''],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);

  // EmitirDatos Test B: with WSDL-correct envelope + urn:emision
  console.log('\n--- EmitirDatos B: WSDL-correct urn:emision envelope ---');
  const gen2 = await soapSimple('GEN2', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol2 = Array.isArray(gen2) ? gen2[0]?.no_documento : null;
  if (!pol2) { console.log('No poliza2'); return; }
  const vin2 = 'LJ22KC' + Date.now().toString(36).toUpperCase();
  
  await soapCorrect('EMIT-B', 'EmitirDatos', [
    ['poliza', pol2], ['ramo_agt', 'AUTOMOVIL'],
    ['vigencia_inicial', fmtDate(today)], ['vigencia_final', fmtDate(ny)],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['apellido_casada', ''], ['tipo_de_cliente', 'N'],
    ['cedula', '8-888-9999'], ['pasaporte', ''], ['ruc', ''],
    ['fecha_nacimiento', '16/06/1994'], ['sexo', 'M'],
    ['telefono_Residencial', '2221133'], ['telefono_oficina', ''],
    ['telefono_celular', '60000001'], ['email', 'test@test.com'],
    ['tipo', 'POLIZA'], ['fecha_de_registro', fmtDate(today)],
    ['cantidad_de_pago', '10'], ['codigo_producto_agt', '07159'],
    ['nombre_producto', 'WEB - AUTORC'], ['Responsable_de_cobro', 'CORREDOR'],
    ['suma_asegurada', '0'], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
    ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
    ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
    ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
    ['no_chasis', vin2], ['nombre_conductor', 'JUAN'],
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', ''],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', vin2], ['no_motor', 'M' + vin2], ['ano', '2025'],
    ['direccion', 'PANAMA'], ['observacion', ''], ['agencia', ''],
    ['direccion_cobros', 'PANAMA'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', ''], ['nombre_grupo', ''], ['token', token],
    ['nacionalidad', 'PANAMA'], ['pep', '002|campo_pep'],
    ['ocupacion', '001'], ['profesion', '1'],
    ['pais_residencia', 'PANAMA'], ['actividad_economica', '001'],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);
}

main().catch(e => console.error('Fatal:', e));
