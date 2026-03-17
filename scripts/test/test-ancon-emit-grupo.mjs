/**
 * Test EmitirDatos with different cod_grupo values.
 * ListadoGrupos returned null — '00001' may be invalid.
 * Also test with empty cod_grupo and different nombre_grupo.
 * Single token, one cotización for all tests.
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
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 300)}`);
  return parsed;
}

function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }

async function tryEmit(label, token, noCot, codGrupo, nombreGrupo) {
  const gen = await soap(`${label}-G`, 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
  if (!pol) return;
  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const v = 'V' + Date.now().toString(36).toUpperCase();
  return await soap(`${label}-E`, 'EmitirDatos', [
    ['poliza', pol], ['ramo_agt', 'AUTOMOVIL'],
    ['vigencia_inicial', fmtDate(today)], ['vigencia_final', fmtDate(ny)],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['apellido_casada', ''], ['tipo_de_cliente', 'N'],
    ['cedula', '8-888-9999'], ['pasaporte', ''], ['ruc', ''],
    ['fecha_nacimiento', '16/06/1994'], ['sexo', 'M'],
    ['telefono_Residencial', '2221133'], ['telefono_oficina', '2221133'],
    ['telefono_celular', '60000001'], ['email', 'test@test.com'],
    ['tipo', 'POLIZA'], ['fecha_de_registro', fmtDate(today)],
    ['cantidad_de_pago', '10'], ['codigo_producto_agt', '07159'],
    ['nombre_producto', 'WEB - AUTORC'], ['Responsable_de_cobro', 'CORREDOR'],
    ['suma_asegurada', '0'], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
    ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
    ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
    ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
    ['no_chasis', v], ['nombre_conductor', 'JUAN'],
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', '000000'],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', v], ['no_motor', 'M' + v], ['ano', '2025'],
    ['direccion', 'PANAMA'], ['observacion', ''], ['agencia', ''],
    ['direccion_cobros', 'PANAMA'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', codGrupo], ['nombre_grupo', nombreGrupo], ['token', token],
    ['nacionalidad', 'PANAMA'], ['pep', '0'], ['ocupacion', '001'],
    ['profesion', '1'], ['pais_residencia', 'PANAMA'], ['actividad_economica', '001'],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);
}

async function main() {
  console.log('=== EMIT FK — COD_GRUPO ISOLATION ===\n');

  const lr = await soap('L', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  const cr = await soap('C', 'Estandar', [
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

  // Test variants
  console.log('--- T1: cod_grupo="" (empty) ---');
  await tryEmit('T1', token, noCot, '', '');

  console.log('\n--- T2: cod_grupo="00001" (doc example) ---');
  await tryEmit('T2', token, noCot, '00001', 'SIN GRUPO');

  console.log('\n--- T3: cod_grupo="0" ---');
  await tryEmit('T3', token, noCot, '0', '');

  console.log('\n--- T4: cod_grupo="1" ---');
  await tryEmit('T4', token, noCot, '1', 'SIN GRUPO');

  // Also try: maybe the FK is from cod_agente being wrong for this product
  // Doc says cod_agente should match the one used in cotización
  // We use 01009 which is our corredor ID. Try '00099' from doc example
  console.log('\n--- T5: cod_agente="00099" (doc example) ---');
  const gen5 = await soap('T5-G', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol5 = Array.isArray(gen5) ? gen5[0]?.no_documento : null;
  if (pol5) {
    const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
    const v = 'V5' + Date.now().toString(36).toUpperCase();
    await soap('T5-E', 'EmitirDatos', [
      ['poliza', pol5], ['ramo_agt', 'AUTOMOVIL'],
      ['vigencia_inicial', fmtDate(today)], ['vigencia_final', fmtDate(ny)],
      ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
      ['segundo_apellido', ''], ['apellido_casada', ''], ['tipo_de_cliente', 'N'],
      ['cedula', '8-888-9999'], ['pasaporte', ''], ['ruc', ''],
      ['fecha_nacimiento', '16/06/1994'], ['sexo', 'M'],
      ['telefono_Residencial', '2221133'], ['telefono_oficina', '2221133'],
      ['telefono_celular', '60000001'], ['email', 'test@test.com'],
      ['tipo', 'POLIZA'], ['fecha_de_registro', fmtDate(today)],
      ['cantidad_de_pago', '10'], ['codigo_producto_agt', '07159'],
      ['nombre_producto', 'WEB - AUTORC'], ['Responsable_de_cobro', 'CORREDOR'],
      ['suma_asegurada', '0'], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
      ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
      ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
      ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
      ['no_chasis', v], ['nombre_conductor', 'JUAN'],
      ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', '000000'],
      ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
      ['vin', v], ['no_motor', 'M' + v], ['ano', '2025'],
      ['direccion', 'PANAMA'], ['observacion', ''], ['agencia', ''],
      ['direccion_cobros', 'PANAMA'], ['descuento', '0'],
      ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '00099'],
      ['opcion', 'A'], ['no_cotizacion', noCot],
      ['cod_grupo', '00001'], ['nombre_grupo', 'SIN GRUPO'], ['token', token],
      ['nacionalidad', 'PANAMA'], ['pep', '0'], ['ocupacion', '001'],
      ['profesion', '1'], ['pais_residencia', 'PANAMA'], ['actividad_economica', '001'],
      ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
    ]);
  }
}

main().catch(e => console.error('Fatal:', e));
