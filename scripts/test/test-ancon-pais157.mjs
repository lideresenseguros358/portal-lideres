/**
 * Test GuardarCliente with PANAMÁ = 157 (numeric code from ANCON cotizador dropdown)
 * 
 * Key findings from cotizador HTML:
 * - #paises dropdown (País de Residencia): value="157" for PANAMÁ
 * - #nacionalidad dropdown: value="PANAMÁ" (name string, not code)
 * - #presidencia: HIDDEN field, auto-filled with gentilicio via buscar_nacionalidad.php
 * - guardar_cliente.php receives: presidencia (country name), nacionalidad (name string)
 * 
 * Hypothesis: prov_residencia field in SOAP GuardarCliente maps to the 
 * #paises dropdown numeric code. Try prov_residencia='157'.
 * 
 * Also: the PHP form sends via guardar_cliente.php (not SOAP), but the
 * SOAP method probably expects the same underlying values.
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
  else parsed = text.substring(0, 500);
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 500)}`);
  return parsed;
}

async function main() {
  console.log('=== PANAMÁ CODE 157 TEST ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // Get fresh cotización
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

  // ===== Test 1: prov_residencia = '157' (PANAMÁ numeric code) =====
  console.log('--- Test 1: prov_residencia=157 ---');
  const gc1 = await soap('GC-157', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMENA'], ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', '157'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '157'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // ===== Test 2: prov_residencia='008' + presidencia='157' =====
  console.log('\n--- Test 2: prov_residencia=008, presidencia=157 ---');
  const gc2 = await soap('GC-pres157', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', '157'], ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', '157'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // ===== Test 3: nacionalidad='157' + prov_residencia='157' =====
  console.log('\n--- Test 3: nacionalidad=157, prov_residencia=157 ---');
  const gc3 = await soap('GC-nac157', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMA'], ['nacionalidad', '157'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', '157'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '157'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // ===== Test 4: ALL country fields as '157' =====
  console.log('\n--- Test 4: ALL country fields = 157 ---');
  const gc4 = await soap('GC-all157', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', '157'], ['nacionalidad', '157'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', '157'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '157'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // ===== Test 5: prov_residencia='157' + pais_nacimiento='PANAMA' (no accent) =====
  console.log('\n--- Test 5: prov_residencia=157, pais_nacimiento=PANAMA ---');
  const gc5 = await soap('GC-mix157', 'GuardarCliente', [
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
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '157'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // If any succeeded, try full emission flow
  const results = [gc1, gc2, gc3, gc4, gc5];
  const success = results.find(r => {
    const msg = Array.isArray(r) ? r[0]?.Mensaje : String(r);
    return msg && (String(msg).includes('xito') || String(msg).includes('Exito') || String(msg) === 'false' || msg === false);
  });
  
  if (success) {
    console.log('\n\n=== SUCCESS! Client registered. Testing full emission flow... ===');
    
    // CIC
    await soap('CIC', 'ClienteIgualContratante', [
      ['token', token], ['no_cotizacion', noCot], ['respuesta', '001'],
    ]);

    // ConsultarCliente
    await soap('CC', 'ConsultarCliente', [
      ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
    ]);

    // GenerarNodocumento
    const gen = await soap('GEN', 'GenerarNodocumento', [
      ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
      ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
    ]);
    const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
    if (!pol) { console.log('No poliza generated'); return; }

    const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
    const fmtDate = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const vin = 'LJWIN' + Date.now().toString(36).toUpperCase();

    await soap('EMIT', 'EmitirDatos', [
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
      ['nacionalidad', 'PANAMA'], ['pep', '002|campo_pep'],
      ['ocupacion', '001'], ['profesion', '1'],
      ['pais_residencia', '157'], ['actividad_economica', '001'],
      ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
    ]);
  } else {
    console.log('\n\nAll GC attempts still fail with "PAÍS DE RESIDENCIA obligatorio".');
    console.log('The WSDL bug blocks these values from being recognized internally.');
  }
}

main().catch(e => console.error('Fatal:', e));
