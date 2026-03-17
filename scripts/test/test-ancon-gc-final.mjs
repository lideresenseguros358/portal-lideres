/**
 * GuardarCliente — FINAL EXHAUSTIVE TESTS
 * 
 * Approach 1: Skip GuardarCliente entirely, use ClienteIgualContratante instead
 *   → Maybe CIC auto-creates the client from cotización data
 * 
 * Approach 2: ConsultarCliente to see if cedula 8-888-9999 already exists
 *   → If it does, maybe we don't need GuardarCliente at all
 * 
 * Approach 3: Try GuardarCliente with cod_producto = 07159 instead of 41
 *   → Maybe the product code affects validation rules
 * 
 * Approach 4: Try with a DIFFERENT cedula that might already exist in ANCON
 *
 * Approach 5: EmitirDatos with pais_residencia filled (it HAS pais_residencia in WSDL!)
 *   → Maybe EmitirDatos handles the client registration internally
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
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 500)}`);
  return parsed;
}

async function main() {
  console.log('=== GC FINAL EXHAUSTIVE ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // Fetch ListaPais to get exact country code/name for PANAMA
  const paises = await soap('ListaPais', 'ListaPais', [['token', token]]);
  if (Array.isArray(paises)) {
    const panama = paises.find(p => p.nombre?.includes('PANAM') || p.cod_pais?.includes('PANAM'));
    console.log('  PANAMA entry:', JSON.stringify(panama));
    console.log('  Pais keys:', Object.keys(paises[0]));
    console.log('  First 5:', paises.slice(0, 5).map(p => JSON.stringify(p)).join('\n    '));
  }

  // Fetch ListaProvincia  
  const provs = await soap('ListaProv', 'ListaProvincia', [['token', token]]);
  if (Array.isArray(provs)) {
    console.log('  Prov keys:', Object.keys(provs[0]));
    const panama = provs.find(p => p.nombre?.toUpperCase().includes('PANAM'));
    console.log('  PANAMA prov:', JSON.stringify(panama));
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
  console.log(`NoCot: ${noCot}\n`);
  if (!noCot) return;

  // ===== Approach 1: ConsultarCliente =====
  console.log('--- ConsultarCliente: check if client exists ---');
  const cc1 = await soap('CC-aseg', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCot], ['figura', '1']]);
  const cc2 = await soap('CC-contr', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCot], ['figura', '2']]);

  // ===== Approach 2: ClienteIgualContratante with respuesta=SI =====
  console.log('\n--- ClienteIgualContratante: respuesta=SI ---');
  const cic1 = await soap('CIC-SI', 'ClienteIgualContratante', [['token', token], ['no_cotizacion', noCot], ['respuesta', 'SI']]);

  // Now check ConsultarCliente again after CIC
  console.log('\n--- ConsultarCliente after CIC ---');
  const cc3 = await soap('CC-after', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCot], ['figura', '1']]);

  // ===== Approach 3: GuardarCliente with cod_producto = '07159' instead of '41' =====
  console.log('\n--- GuardarCliente with cod_producto=07159 ---');
  await soap('GC-07159', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '07159'], ['pasaporte', ''],
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
    ['cli_forpago', '002'], ['cli_frepago', '002'], 
    ['cli_lista', '002|campo_lista_neg'],
    ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'],
    ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // ===== Approach 4: EmitirDatos directly (it has pais_residencia in WSDL!) =====
  // Hypothesis: Maybe EmitirDatos doesn't need GuardarCliente at all for DT
  // The FK error might be from cod_grupo or something else
  console.log('\n--- EmitirDatos: with ALL compliance fields filled from catalogs ---');
  const gen = await soap('GEN', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
  if (!pol) { console.log('No poliza'); return; }

  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const fmtDate = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const vin = 'LJFIN' + Date.now().toString(36).toUpperCase();

  // Use pais code from ListaPais if available
  let paisCode = 'PANAMÁ';
  if (Array.isArray(paises)) {
    const panama = paises.find(p => (p.nombre || '').toUpperCase().includes('PANAM'));
    if (panama) paisCode = panama.cod_pais || panama.codigo || paisCode;
    console.log(`  Using paisCode for EmitirDatos: ${paisCode}`);
  }

  await soap('EMIT-FULL', 'EmitirDatos', [
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
    ['direccion', 'PANAMA CITY'], ['observacion', ''], ['agencia', ''],
    ['direccion_cobros', 'PANAMA CITY'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', ''], ['nombre_grupo', ''], ['token', token],
    ['nacionalidad', String(paisCode)], ['pep', '002|campo_pep'],
    ['ocupacion', '001'], ['profesion', '1'],
    ['pais_residencia', String(paisCode)], ['actividad_economica', '001'],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);

  // ===== Approach 5: EmitirDatos with ListaPais NAME values =====
  console.log('\n--- EmitirDatos: with ListaPais NAMES + ListaActividad ---');
  // First get actividad
  const actividades = await soap('ListaActividad', 'ListaActividad', [['token', token]]);
  if (Array.isArray(actividades)) {
    console.log('  Act keys:', Object.keys(actividades[0]));
    console.log('  First 3:', actividades.slice(0, 3).map(a => JSON.stringify(a)).join('\n    '));
  }

  const gen2 = await soap('GEN2', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol2 = Array.isArray(gen2) ? gen2[0]?.no_documento : null;
  if (!pol2) { console.log('No poliza2'); return; }
  const vin2 = 'LJFI2' + Date.now().toString(36).toUpperCase();

  // Try with NAME values from catalogs
  let paisName = 'PANAMÁ';
  if (Array.isArray(paises)) {
    const panama = paises.find(p => (p.nombre || '').toUpperCase().includes('PANAM'));
    if (panama) paisName = panama.nombre || paisName;
  }
  let actCode = '';
  if (Array.isArray(actividades) && actividades.length > 0) {
    actCode = actividades[0].cod_actividad || actividades[0].codigo || Object.values(actividades[0])[0] || '';
  }
  console.log(`  paisName=${paisName}, actCode=${actCode}`);

  await soap('EMIT-NAMES', 'EmitirDatos', [
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
    ['direccion', 'PANAMA CITY'], ['observacion', ''], ['agencia', ''],
    ['direccion_cobros', 'PANAMA CITY'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', ''], ['nombre_grupo', ''], ['token', token],
    ['nacionalidad', paisName], ['pep', '002|campo_pep'],
    ['ocupacion', '001'], ['profesion', '1'],
    ['pais_residencia', paisName], ['actividad_economica', String(actCode)],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);
}

main().catch(e => console.error('Fatal:', e));
