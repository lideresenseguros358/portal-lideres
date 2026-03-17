/**
 * Test ClienteIgualContratante with numeric codes from catalog
 * AND test the FULL emission flow without GuardarCliente
 * 
 * Key discovery: ListaAseguradoContratante returns {cod_clicontrol: '001', nombre: 'SI'}
 * So ClienteIgualContratante.respuesta should be '001' (not 'SI')
 * 
 * Also test: What if the FK error in EmitirDatos is from the CLIENT not being
 * registered at all? Maybe the flow should be:
 *   Estandar → ClienteIgualContratante(001) → EmitirDatos
 * Instead of:
 *   Estandar → GuardarCliente → EmitirDatos
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
  console.log('=== CIC FLOW TEST ===\n');

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

  // ===== Test ClienteIgualContratante with different respuesta values =====
  console.log('--- CIC Tests ---');
  
  // Test 1: respuesta='001' (SI from ListaAseguradoContratante)
  console.log('\nCIC-1: respuesta=001');
  const cic1 = await soap('CIC-001', 'ClienteIgualContratante', [
    ['token', token], ['no_cotizacion', noCot], ['respuesta', '001'],
  ]);

  // Test 2: respuesta='1' 
  console.log('\nCIC-2: respuesta=1');
  const cic2 = await soap('CIC-1', 'ClienteIgualContratante', [
    ['token', token], ['no_cotizacion', noCot], ['respuesta', '1'],
  ]);

  // Test 3: respuesta='S'
  console.log('\nCIC-3: respuesta=S');
  const cic3 = await soap('CIC-S', 'ClienteIgualContratante', [
    ['token', token], ['no_cotizacion', noCot], ['respuesta', 'S'],
  ]);

  // Test 4: respuesta='0' (maybe 0=yes, 1=no?)
  console.log('\nCIC-4: respuesta=0');
  const cic4 = await soap('CIC-0', 'ClienteIgualContratante', [
    ['token', token], ['no_cotizacion', noCot], ['respuesta', '0'],
  ]);

  // Test 5: respuesta='' (empty)
  console.log('\nCIC-5: respuesta=empty');
  const cic5 = await soap('CIC-empty', 'ClienteIgualContratante', [
    ['token', token], ['no_cotizacion', noCot], ['respuesta', ''],
  ]);

  // ===== If any CIC succeeded, try EmitirDatos =====
  console.log('\n--- After CIC, try ConsultarCliente ---');
  const cc = await soap('CC', 'ConsultarCliente', [
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // Try EmitirDatos now
  console.log('\n--- EmitirDatos after CIC calls ---');
  const gen = await soap('GEN', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
  if (!pol) { console.log('No poliza'); return; }

  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const fmtDate = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const vin = 'LJCIC' + Date.now().toString(36).toUpperCase();

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
    ['nacionalidad', 'PANAMÁ'], ['pep', '002|campo_pep'],
    ['ocupacion', '001'], ['profesion', '1'],
    ['pais_residencia', 'PANAMÁ'], ['actividad_economica', '001'],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);

  // ===== NEW IDEA: What if cotizacion format for ConsultarCliente is without the prefix? =====
  // NoCot format is '009-1397226' — maybe ConsultarCliente needs just '1397226'?
  console.log('\n--- ConsultarCliente with short cotization number ---');
  const shortCot = noCot.split('-').pop();
  console.log(`  shortCot: ${shortCot}`);
  const cc2 = await soap('CC-short', 'ConsultarCliente', [
    ['token', token], ['no_cotizacion', shortCot], ['figura', '1'],
  ]);

  // ===== FULL EMISSION with CC product (00312) to compare error =====
  // CC should require inspection — if it gives a DIFFERENT error, that tells us something
  console.log('\n\n--- CC product (00312) emission comparison ---');
  const crCC = await soap('COT-CC', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '21500'], ['cod_producto', '00312'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]);
  let noCotCC = null;
  if (crCC?.cotizacion) {
    for (const items of Object.values(crCC.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCotCC = it.Descripcion1; break; } }
      }
      if (noCotCC) break;
    }
  }
  console.log(`NoCotCC: ${noCotCC}`);
  if (!noCotCC) return;

  const genCC = await soap('GEN-CC', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '001'], ['cod_subramo', '001'], ['token', token],
  ]);
  const polCC = Array.isArray(genCC) ? genCC[0]?.no_documento : null;
  if (!polCC) { console.log('No poliza CC'); return; }
  const vinCC = 'LJCC' + Date.now().toString(36).toUpperCase();

  await soap('EMIT-CC', 'EmitirDatos', [
    ['poliza', polCC], ['ramo_agt', 'AUTOMOVIL'],
    ['vigencia_inicial', fmtDate(today)], ['vigencia_final', fmtDate(ny)],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['apellido_casada', ''], ['tipo_de_cliente', 'N'],
    ['cedula', '8-888-9999'], ['pasaporte', ''], ['ruc', ''],
    ['fecha_nacimiento', '16/06/1994'], ['sexo', 'M'],
    ['telefono_Residencial', '2221133'], ['telefono_oficina', ''],
    ['telefono_celular', '60000001'], ['email', 'test@test.com'],
    ['tipo', 'POLIZA'], ['fecha_de_registro', fmtDate(today)],
    ['cantidad_de_pago', '10'], ['codigo_producto_agt', '00312'],
    ['nombre_producto', 'AUTO COMPLETA'], ['Responsable_de_cobro', 'CORREDOR'],
    ['suma_asegurada', '21500'], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
    ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
    ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
    ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
    ['no_chasis', vinCC], ['nombre_conductor', 'JUAN'],
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', ''],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', vinCC], ['no_motor', 'M' + vinCC], ['ano', '2025'],
    ['direccion', 'PANAMA CITY'], ['observacion', ''], ['agencia', ''],
    ['direccion_cobros', 'PANAMA CITY'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCotCC],
    ['cod_grupo', ''], ['nombre_grupo', ''], ['token', token],
    ['nacionalidad', 'PANAMÁ'], ['pep', '002|campo_pep'],
    ['ocupacion', '001'], ['profesion', '1'],
    ['pais_residencia', 'PANAMÁ'], ['actividad_economica', '001'],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);
}

main().catch(e => console.error('Fatal:', e));
