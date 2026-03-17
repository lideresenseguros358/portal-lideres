/**
 * Debug FK constraint error on EmitirDatos
 * 
 * Theory 1: FK is from missing CLIENT record → GuardarCliente fails
 * Theory 2: FK is from cod_grupo being empty/invalid
 * Theory 3: FK is from ramo/subramo mismatch
 * Theory 4: FK is from the poliza number not matching cotización's product
 * 
 * Test plan:
 * A) Try EmitirDatos with cod_grupo from ListadoGrupos (even if null, try '0', '00001', etc)
 * B) Try with different ramo codes in GenerarNodocumento
 * C) Try with ClienteIgualContratante BEFORE EmitirDatos
 * D) Try GuardarCliente → ignore error → EmitirDatos (maybe client IS partially created)
 * E) Try with cod_agente variations
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

function emitPairs(pol, noCot, vin, opts = {}) {
  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const fmtDate = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  return [
    ['poliza', pol], ['ramo_agt', opts.ramo_agt || 'AUTOMOVIL'],
    ['vigencia_inicial', fmtDate(today)], ['vigencia_final', fmtDate(ny)],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['apellido_casada', ''], ['tipo_de_cliente', 'N'],
    ['cedula', '8-888-9999'], ['pasaporte', ''], ['ruc', ''],
    ['fecha_nacimiento', '16/06/1994'], ['sexo', 'M'],
    ['telefono_Residencial', '2221133'], ['telefono_oficina', ''],
    ['telefono_celular', '60000001'], ['email', 'test@test.com'],
    ['tipo', 'POLIZA'], ['fecha_de_registro', fmtDate(today)],
    ['cantidad_de_pago', opts.cantidad_de_pago || '10'], 
    ['codigo_producto_agt', opts.producto || '07159'],
    ['nombre_producto', opts.nombre_producto || 'WEB - AUTORC'], 
    ['Responsable_de_cobro', 'CORREDOR'],
    ['suma_asegurada', opts.suma || '0'], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
    ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
    ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
    ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
    ['no_chasis', vin], ['nombre_conductor', 'JUAN'],
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', opts.placa || ''],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', vin], ['no_motor', 'M' + vin], ['ano', '2025'],
    ['direccion', 'PANAMA CITY'], ['observacion', opts.observacion || ''], ['agencia', ''],
    ['direccion_cobros', 'PANAMA CITY'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', opts.cod_agente || '01009'],
    ['opcion', opts.opcion || 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', opts.cod_grupo ?? ''], ['nombre_grupo', opts.nombre_grupo ?? ''], 
    ['token', opts.token],
    ['nacionalidad', 'PANAMÁ'], ['pep', '002|campo_pep'],
    ['ocupacion', '001'], ['profesion', '1'],
    ['pais_residencia', 'PANAMÁ'], ['actividad_economica', '001'],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ];
}

async function main() {
  console.log('=== FK DEBUG ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // ListadoGrupos
  console.log('\n--- ListadoGrupos ---');
  const grupos = await soap('GRUPOS', 'ListadoGrupos', [['token', token]]);

  // Cotización DT
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

  // ===== Test A: GuardarCliente THEN CIC THEN EmitirDatos =====
  console.log('--- A: GuardarCliente → CIC → EmitirDatos ---');
  const gc = await soap('GC', 'GuardarCliente', [
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
  const cic = await soap('CIC', 'ClienteIgualContratante', [
    ['token', token], ['no_cotizacion', noCot], ['respuesta', '001'],
  ]);

  // Generate poliza
  const gen = await soap('GEN', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
  if (!pol) { console.log('No poliza'); return; }
  const vin = 'LJFK1' + Date.now().toString(36).toUpperCase();
  
  const emitA = await soap('EMIT-A', 'EmitirDatos', emitPairs(pol, noCot, vin, { token }));

  // ===== Test B: Different cod_ramo values for GenerarNodocumento =====
  console.log('\n--- B: Different cod_ramo for DT ---');
  
  // Try cod_ramo=001 (same as CC)
  const gen2 = await soap('GEN-ramo1', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '001'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol2 = Array.isArray(gen2) ? gen2[0]?.no_documento : null;
  if (pol2) {
    const vin2 = 'LJFK2' + Date.now().toString(36).toUpperCase();
    await soap('EMIT-B-r1', 'EmitirDatos', emitPairs(pol2, noCot, vin2, { token }));
  }

  // ===== Test C: cod_grupo = '00001' =====
  console.log('\n--- C: cod_grupo=00001 ---');
  const gen3 = await soap('GEN3', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol3 = Array.isArray(gen3) ? gen3[0]?.no_documento : null;
  if (pol3) {
    const vin3 = 'LJFK3' + Date.now().toString(36).toUpperCase();
    await soap('EMIT-C', 'EmitirDatos', emitPairs(pol3, noCot, vin3, { 
      token, cod_grupo: '00001', nombre_grupo: 'GRUPO1' 
    }));
  }

  // ===== Test D: Try with cod_agente = '00099' (from doc example) =====
  console.log('\n--- D: cod_agente=00099 ---');
  const gen4 = await soap('GEN4', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol4 = Array.isArray(gen4) ? gen4[0]?.no_documento : null;
  if (pol4) {
    const vin4 = 'LJFK4' + Date.now().toString(36).toUpperCase();
    await soap('EMIT-D', 'EmitirDatos', emitPairs(pol4, noCot, vin4, { 
      token, cod_agente: '00099' 
    }));
  }

  // ===== Test E: cantidad_de_pago=1 (contado) =====
  console.log('\n--- E: cantidad_de_pago=1 ---');
  const gen5 = await soap('GEN5', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol5 = Array.isArray(gen5) ? gen5[0]?.no_documento : null;
  if (pol5) {
    const vin5 = 'LJFK5' + Date.now().toString(36).toUpperCase();
    await soap('EMIT-E', 'EmitirDatos', emitPairs(pol5, noCot, vin5, { 
      token, cantidad_de_pago: '1' 
    }));
  }

  // ===== Test F: opcion=B or C =====
  console.log('\n--- F: opcion=B ---');
  const gen6 = await soap('GEN6', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol6 = Array.isArray(gen6) ? gen6[0]?.no_documento : null;
  if (pol6) {
    const vin6 = 'LJFK6' + Date.now().toString(36).toUpperCase();
    await soap('EMIT-F', 'EmitirDatos', emitPairs(pol6, noCot, vin6, { 
      token, opcion: 'B' 
    }));
  }

  // ===== Test G: WITH placa + observacion filled (maybe required for DT?) =====
  console.log('\n--- G: placa + observacion filled ---');
  const gen7 = await soap('GEN7', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol7 = Array.isArray(gen7) ? gen7[0]?.no_documento : null;
  if (pol7) {
    const vin7 = 'LJFK7' + Date.now().toString(36).toUpperCase();
    await soap('EMIT-G', 'EmitirDatos', emitPairs(pol7, noCot, vin7, { 
      token, placa: '987654', observacion: 'TEST' 
    }));
  }
}

main().catch(e => console.error('Fatal:', e));
