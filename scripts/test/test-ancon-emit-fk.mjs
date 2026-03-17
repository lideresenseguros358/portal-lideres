/**
 * Isolate EmitirDatos FK constraint — test different value formats
 * for pep, ocupacion, profesion, actividad_economica, nacionalidad, pais_residencia
 * 
 * Key hypothesis: pep='002' should be '0' (doc page 2 shows pep:0)
 * Or pipe format from catalog: '002|campo_pep'
 * 
 * Minimal flow: Token → Estandar → GenerarNodocumento → EmitirDatos (variants)
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function env(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

async function soap(label, method, pairs) {
  const body = env(method, pairs);
  const t0 = Date.now();
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const elapsed = Date.now() - t0;
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`[${label}] (${elapsed}ms) -> ${JSON.stringify(parsed).substring(0, 350)}`);
  return parsed;
}

function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }

async function tryEmit(label, token, noCot, overrides) {
  // Generate fresh poliza
  const genRes = await soap(`${label}-GEN`, 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const poliza = Array.isArray(genRes) ? genRes[0]?.no_documento : null;
  if (!poliza) { console.log(`  ${label}: No poliza generated`); return null; }

  const today = new Date();
  const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const vin = 'TEST' + Date.now().toString(36).toUpperCase();

  // Base emission params — EXACT WSDL order from EmitirDatosRequest
  const base = [
    ['poliza', poliza], ['ramo_agt', 'AUTOMOVIL'],
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
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', '000000'],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', vin], ['no_motor', 'MOT' + vin], ['ano', '2025'],
    ['direccion', 'PANAMA'], ['observacion', ''], ['agencia', ''],
    ['direccion_cobros', 'PANAMA'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', '00001'], ['nombre_grupo', 'SIN GRUPO'], ['token', token],
  ];

  // Apply overrides for the compliance fields at the end
  const compliance = [
    ['nacionalidad', overrides.nacionalidad ?? 'PANAMA'],
    ['pep', overrides.pep ?? '0'],
    ['ocupacion', overrides.ocupacion ?? '001'],
    ['profesion', overrides.profesion ?? '1'],
    ['pais_residencia', overrides.pais_residencia ?? 'PANAMA'],
    ['actividad_economica', overrides.actividad_economica ?? ''],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ];

  const result = await soap(`${label}-EMIT`, 'EmitirDatos', [...base, ...compliance]);
  return result;
}

async function main() {
  console.log('=== EMITIR FK CONSTRAINT ISOLATION ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) { console.error('Login failed'); return; }

  // Single cotización for all tests
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

  // Test 1: pep='0' (doc page 2 style), all other fields empty
  console.log('--- Test 1: pep=0, all compliance empty ---');
  await tryEmit('T1', token, noCot, {
    pep: '0', ocupacion: '', profesion: '', actividad_economica: '',
    nacionalidad: '', pais_residencia: '',
  });

  // Test 2: pep='0', nacionalidad/pais from catalog names
  console.log('\n--- Test 2: pep=0, nacionalidad=PANAMA, pais_residencia=PANAMA ---');
  await tryEmit('T2', token, noCot, {
    pep: '0', ocupacion: '001', profesion: '1', actividad_economica: '001',
    nacionalidad: 'PANAMA', pais_residencia: 'PANAMA',
  });

  // Test 3: All compliance fields as '0' or empty
  console.log('\n--- Test 3: pep=0, ocupacion empty, profesion empty ---');
  await tryEmit('T3', token, noCot, {
    pep: '0', ocupacion: '', profesion: '', actividad_economica: '',
    nacionalidad: 'PANAMA', pais_residencia: 'PANAMA',
  });

  // Test 4: Without cod_grupo at all (maybe FK is from cod_grupo)
  // Can't easily do this with tryEmit, do manually
  console.log('\n--- Test 4: No cod_grupo/nombre_grupo ---');
  const gen4 = await soap('T4-GEN', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol4 = Array.isArray(gen4) ? gen4[0]?.no_documento : null;
  if (pol4) {
    const today = new Date();
    const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
    const vin4 = 'T4' + Date.now().toString(36).toUpperCase();
    // Omit cod_grupo and nombre_grupo entirely
    await soap('T4-EMIT', 'EmitirDatos', [
      ['poliza', pol4], ['ramo_agt', 'AUTOMOVIL'],
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
      ['no_chasis', vin4], ['nombre_conductor', 'JUAN'],
      ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', '000000'],
      ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
      ['vin', vin4], ['no_motor', 'M' + vin4], ['ano', '2025'],
      ['direccion', 'PANAMA'], ['observacion', ''], ['agencia', ''],
      ['direccion_cobros', 'PANAMA'], ['descuento', '0'],
      ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
      ['opcion', 'A'], ['no_cotizacion', noCot],
      // NO cod_grupo, NO nombre_grupo
      ['token', token],
      ['nacionalidad', 'PANAMA'], ['pep', '0'], ['ocupacion', '001'],
      ['profesion', '1'], ['pais_residencia', 'PANAMA'], ['actividad_economica', '001'],
      ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
    ]);
  }
}

main().catch(e => console.error('Fatal:', e));
