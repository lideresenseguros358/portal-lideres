/**
 * Test inspection flow for CC product AND verify if the FK error
 * is specifically about client registration.
 * 
 * Also try: ListadoExpedientes to see if there are any existing expedientes
 * that might give us a real client cedula to test with.
 * 
 * AND: Try a commercial RC product (07132-07135) which might have different
 * requirements than DT (07159).
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
  console.log('=== INSPECTION + EXPEDIENTES + COMMERCIAL RC ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // ===== Check existing inspections and expedientes =====
  console.log('--- ListadoInspeccion ---');
  const insp = await soap('INSP', 'ListadoInspeccion', [['token', token], ['cod_agente', '01009']]);
  
  console.log('\n--- ListadoExpedientes ---');
  const exp = await soap('EXP', 'ListadoExpedientes', [['token', token], ['cod_agente', '01009'], ['usuario', '01009']]);

  // ===== Try commercial RC products (07132 = Liviano) =====
  // These are DT-like (RC only) so they might share the same flow
  console.log('\n--- Commercial RC: product 07132 (Liviano) ---');
  const crRC = await soap('COT-RC', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '0'], ['cod_producto', '07132'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]);
  
  // Try SOBAT DT products  
  console.log('\n--- SOBAT DT: product 07133 (Mediano) ---');
  const crSOBAT = await soap('COT-SOBAT', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '0'], ['cod_producto', '07133'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]);

  // ===== GenerarAcreedores =====
  console.log('\n--- GenerarAcreedores ---');
  const acreedores = await soap('ACREED', 'GenerarAcreedores', [['token', token]]);

  // ===== Try EmitirDatos for DT with FULL address and all fields =====
  // Maybe the issue is a specific field being empty that shouldn't be
  console.log('\n--- DT emission with ALL fields populated ---');
  const cr = await soap('COT-DT', 'Estandar', [
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
  console.log(`NoCot DT: ${noCot}`);
  if (!noCot) return;

  // GuardarCliente (will fail but calling anyway)
  await soap('GC', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', 'TEST'], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', 'TEST'], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMA'], ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'CALLE 50, PANAMA CITY'], ['calle', 'CALLE 50'], ['casa', '100'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'CALLE 50, PANAMA CITY'], ['telefono1', '2221133'], ['telefono2', '2221134'],
    ['celular', '60000001'], ['celular2', '60000002'], ['email', 'test@test.com'], ['apartado', '0000'],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMÁ'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'],
    ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // CIC
  await soap('CIC', 'ClienteIgualContratante', [
    ['token', token], ['no_cotizacion', noCot], ['respuesta', '001'],
  ]);

  // ConsultarCliente to check status
  await soap('CC-check', 'ConsultarCliente', [
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // Generate poliza and emit with ALL fields filled
  const gen = await soap('GEN', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
  if (!pol) { console.log('No poliza'); return; }
  
  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const fmtDate = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const vin = 'LJALL' + Date.now().toString(36).toUpperCase();

  // Try with ramo_agt='RC AUTOMOVIL' or 'DAÑOS A TERCEROS' instead of 'AUTOMOVIL'
  console.log('\n--- EmitirDatos with ramo_agt variations ---');
  
  // ramo_agt = 'RC AUTOMOVIL'
  await soap('EMIT-RC', 'EmitirDatos', [
    ['poliza', pol], ['ramo_agt', 'RC AUTOMOVIL'],
    ['vigencia_inicial', fmtDate(today)], ['vigencia_final', fmtDate(ny)],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', 'TEST'], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', 'TEST'], ['apellido_casada', ''], ['tipo_de_cliente', 'N'],
    ['cedula', '8-888-9999'], ['pasaporte', ''], ['ruc', ''],
    ['fecha_nacimiento', '16/06/1994'], ['sexo', 'M'],
    ['telefono_Residencial', '2221133'], ['telefono_oficina', '2221134'],
    ['telefono_celular', '60000001'], ['email', 'test@test.com'],
    ['tipo', 'POLIZA'], ['fecha_de_registro', fmtDate(today)],
    ['cantidad_de_pago', '10'], ['codigo_producto_agt', '07159'],
    ['nombre_producto', 'WEB - AUTORC'], ['Responsable_de_cobro', 'CORREDOR'],
    ['suma_asegurada', '0'], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
    ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
    ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
    ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
    ['no_chasis', vin], ['nombre_conductor', 'JUAN'],
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', 'ABC123'],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', vin], ['no_motor', 'M' + vin], ['ano', '2025'],
    ['direccion', 'CALLE 50, PANAMA CITY'], ['observacion', 'TEST'], ['agencia', ''],
    ['direccion_cobros', 'CALLE 50, PANAMA CITY'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', ''], ['nombre_grupo', ''], ['token', token],
    ['nacionalidad', 'PANAMÁ'], ['pep', '002|campo_pep'],
    ['ocupacion', '001'], ['profesion', '1'],
    ['pais_residencia', 'PANAMÁ'], ['actividad_economica', '001'],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);
}

main().catch(e => console.error('Fatal:', e));
