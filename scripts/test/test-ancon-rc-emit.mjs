/**
 * Test FULL emission flow with commercial RC product (07132)
 * to see if the FK error is product-specific or universal.
 * 
 * Also test ConsultarCliente with various cotización formats.
 * And test GuardarCliente with figura='contratante' (from docs page 20-25)
 * instead of '1'.
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
  console.log('=== RC EMISSION + CONSULTAR FORMATS ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // ===== TEST 1: Commercial RC (07132) full emission flow =====
  console.log('--- RC 07132 Cotización ---');
  const crRC = await soap('COT-RC', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '0'], ['cod_producto', '07132'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]);
  let noCotRC = null;
  if (crRC?.cotizacion) {
    for (const items of Object.values(crRC.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCotRC = it.Descripcion1; break; } }
      }
      if (noCotRC) break;
    }
  }
  console.log(`NoCotRC: ${noCotRC}`);
  if (!noCotRC) return;

  // GuardarCliente for RC
  console.log('\n--- GC for RC ---');
  await soap('GC-RC', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMA'], ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMÁ'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCotRC], ['figura', '1'],
  ]);

  // CIC for RC
  await soap('CIC-RC', 'ClienteIgualContratante', [
    ['token', token], ['no_cotizacion', noCotRC], ['respuesta', '001'],
  ]);

  // EmitirDatos for RC (07132 = RC Comercial Liviano)
  const genRC = await soap('GEN-RC', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const polRC = Array.isArray(genRC) ? genRC[0]?.no_documento : null;
  if (!polRC) { console.log('No poliza RC'); return; }

  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const fmtDate = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const vinRC = 'LJRC1' + Date.now().toString(36).toUpperCase();

  console.log('\n--- EmitirDatos RC 07132 ---');
  await soap('EMIT-RC', 'EmitirDatos', [
    ['poliza', polRC], ['ramo_agt', 'AUTOMOVIL'],
    ['vigencia_inicial', fmtDate(today)], ['vigencia_final', fmtDate(ny)],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['apellido_casada', ''], ['tipo_de_cliente', 'N'],
    ['cedula', '8-888-9999'], ['pasaporte', ''], ['ruc', ''],
    ['fecha_nacimiento', '16/06/1994'], ['sexo', 'M'],
    ['telefono_Residencial', '2221133'], ['telefono_oficina', ''],
    ['telefono_celular', '60000001'], ['email', 'test@test.com'],
    ['tipo', 'POLIZA'], ['fecha_de_registro', fmtDate(today)],
    ['cantidad_de_pago', '10'], ['codigo_producto_agt', '07132'],
    ['nombre_producto', 'RC COMERCIAL LIVIANO'], ['Responsable_de_cobro', 'CORREDOR'],
    ['suma_asegurada', '0'], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
    ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
    ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
    ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
    ['no_chasis', vinRC], ['nombre_conductor', 'JUAN'],
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', ''],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', vinRC], ['no_motor', 'M' + vinRC], ['ano', '2025'],
    ['direccion', 'PANAMA CITY'], ['observacion', ''], ['agencia', ''],
    ['direccion_cobros', 'PANAMA CITY'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCotRC],
    ['cod_grupo', ''], ['nombre_grupo', ''], ['token', token],
    ['nacionalidad', 'PANAMÁ'], ['pep', '002|campo_pep'],
    ['ocupacion', '001'], ['profesion', '1'],
    ['pais_residencia', 'PANAMÁ'], ['actividad_economica', '001'],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);

  // ===== TEST 2: ConsultarCliente with different cotización formats =====
  console.log('\n\n--- ConsultarCliente format tests ---');
  // Format 1: full (009-1397273)
  await soap('CC-full', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCotRC], ['figura', '1']]);
  // Format 2: without prefix
  const shortCot = noCotRC.split('-').slice(1).join('-');
  await soap('CC-short', 'ConsultarCliente', [['token', token], ['no_cotizacion', shortCot], ['figura', '1']]);
  // Format 3: just number
  const numOnly = noCotRC.replace(/\D/g, '');
  await soap('CC-num', 'ConsultarCliente', [['token', token], ['no_cotizacion', numOnly], ['figura', '1']]);
  // Format 4: with different figura values
  await soap('CC-fig2', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCotRC], ['figura', '2']]);
  await soap('CC-fig-contr', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCotRC], ['figura', 'contratante']]);
  await soap('CC-fig-aseg', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCotRC], ['figura', 'asegurado']]);

  // ===== TEST 3: GuardarCliente with figura='contratante' (from docs) =====
  console.log('\n\n--- GC with figura=contratante ---');
  // Need fresh cotización
  const crDT = await soap('COT-DT2', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '0'], ['cod_producto', '07159'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]);
  let noCotDT = null;
  if (crDT?.cotizacion) {
    for (const items of Object.values(crDT.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCotDT = it.Descripcion1; break; } }
      }
      if (noCotDT) break;
    }
  }
  console.log(`NoCotDT: ${noCotDT}`);
  
  await soap('GC-contr', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMA'], ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMÁ'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCotDT], ['figura', 'contratante'],
  ]);

  // Also with figura='asegurado'
  await soap('GC-aseg', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMA'], ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMÁ'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCotDT], ['figura', 'asegurado'],
  ]);
}

main().catch(e => console.error('Fatal:', e));
