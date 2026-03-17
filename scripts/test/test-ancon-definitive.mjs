/**
 * DEFINITIVE FK test — minimal flow, single token
 * Test 1: cod_grupo='', nombre_grupo=''
 * Test 2: cod_grupo='00001', nombre_grupo='SIN GRUPO' 
 * Test 3: Try ListadoGrupos to get VALID groups
 * 
 * EACH test gets its own fresh token + cotización to avoid token expiry.
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
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 350)}`);
  return parsed;
}

function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }

async function fullEmitTest(label, codGrupo, nombreGrupo) {
  console.log(`\n${'='.repeat(60)}\n${label}\n${'='.repeat(60)}`);
  
  // Fresh token
  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) { console.log('  Login failed'); return; }

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
  if (!noCot) { console.log('  No cotización'); return; }
  console.log(`  NoCot: ${noCot}`);

  // GenDoc
  const gen = await soap('GEN', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
  if (!pol) { console.log('  No poliza'); return; }

  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const vin = 'LJ11KB' + Date.now().toString(36).toUpperCase();

  // EmitirDatos
  const r = await soap('EMIT', 'EmitirDatos', [
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
    ['no_chasis', vin], ['nombre_conductor', 'JUAN'],
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', '987654'],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', vin], ['no_motor', 'M' + vin], ['ano', '2025'],
    ['direccion', 'TEST'], ['observacion', 'TEST'], ['agencia', ''],
    ['direccion_cobros', 'TEST'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', codGrupo], ['nombre_grupo', nombreGrupo], ['token', token],
    ['nacionalidad', 'PANAMA'], ['pep', '002|campo_pep'],
    ['ocupacion', '001'], ['profesion', '1'],
    ['pais_residencia', 'PANAMA'], ['actividad_economica', '001'],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);

  let ok = false;
  if (typeof r === 'object' && r) {
    for (const v of Object.values(r)) { if (Array.isArray(v) && v[0]?.p1 === '0') { ok = true; break; } }
    if (r.Respuesta) console.log(`  ERROR: ${typeof r.Respuesta === 'string' ? r.Respuesta : JSON.stringify(r.Respuesta)}`);
  }
  if (typeof r === 'string') console.log(`  ERROR: ${r.substring(0, 200)}`);
  console.log(`  RESULT: ${ok ? '🎉 SUCCESS' : '❌ FAILED'}`);
}

async function main() {
  // First check ListadoGrupos
  console.log('=== CHECKING GRUPOS ===');
  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (token) {
    const groups = await soap('GRUPOS', 'ListadoGrupos', [['token', token]]);
    console.log('  Groups result:', JSON.stringify(groups));
    
    // Also check GenerarAcreedores
    const acreedores = await soap('ACREE', 'GenerarAcreedores', [['token', token]]);
    if (Array.isArray(acreedores)) console.log('  First 3 acreedores:', acreedores.slice(0,3).map(a => JSON.stringify(a)).join('\n    '));
  }

  // Test 1: Empty cod_grupo
  await fullEmitTest('TEST 1: cod_grupo="" (empty)', '', '');

  // Test 2: cod_grupo='00001'
  await fullEmitTest('TEST 2: cod_grupo="00001"', '00001', 'SIN GRUPO');

  // Test 3: cod_grupo='0'
  await fullEmitTest('TEST 3: cod_grupo="0"', '0', '');
}

main().catch(e => console.error('Fatal:', e));
