/**
 * GuardarCliente v3 — Add pais_residencia AFTER all WSDL params
 * The server requires it but WSDL doesn't declare it.
 * Also add es_fumador from doc page 26.
 * Use only ASCII chars to avoid SQL syntax errors.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function buildEnvelope(method, paramPairs) {
  const xml = paramPairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

async function soap(label, method, paramPairs) {
  const body = buildEnvelope(method, paramPairs);
  const t0 = Date.now();
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const elapsed = Date.now() - t0;
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`[${label}] (${elapsed}ms) -> ${JSON.stringify(parsed).substring(0, 400)}`);
  return parsed;
}

function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }

async function main() {
  console.log('=== GUARDAR CLIENTE v3 + FULL EMISSION ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) { console.error('Login failed'); return; }

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

  // Test A: WSDL params + pais_residencia BETWEEN razon_social and token
  // Maybe the server reads params positionally
  console.log('-- Test A: pais_residencia between razon_social and es_fumador --');
  const gcA = await soap('GC-A', 'GuardarCliente', [
    ['tipo_persona', 'N'],
    ['cod_producto', '41'],
    ['pasaporte', ''],
    ['primer_nombre', 'JUAN'],
    ['segundo_nombre', ''],
    ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''],
    ['casada', ''],
    ['fecha_nac', '16/06/1994'],
    ['sexo', 'M'],
    ['presidencia', 'PANAMA'],
    ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA CITY'],
    ['calle', 'CALLE 50'],
    ['casa', '1'],
    ['barriada', 'EL CANGREJO'],
    ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA CITY'],
    ['telefono1', '2221133'],
    ['telefono2', ''],
    ['celular', '60000001'],
    ['celular2', ''],
    ['email', 'test@test.com'],
    ['apartado', ''],
    ['ced_prov', '8'],
    ['ced_inicial', '888'],
    ['tomo', '9999'],
    ['folio', ''],
    ['asiento', ''],
    ['ocupacion', '001'],
    ['pais_nacimiento', 'PANAMA'],
    ['ofondo', '001'],
    ['monto_ingreso', '001'],
    ['prov_residencia', '008'],
    ['cli_forpago', '002'],
    ['cli_frepago', '002'],
    ['cli_lista', '002'],
    ['cli_fundacion', '002'],
    ['cli_pep1', '002'],
    ['asegurado_igual', '001'],
    ['asegurado_benef', '004'],
    ['asegurado_tercero', '006'],
    ['cli_coa', '0'],
    ['dv', ''],
    ['rlegal', ''],
    ['ncomercial', ''],
    ['aoperacion', ''],
    ['cod_actividad', ''],
    ['cod_clianiocon', ''],
    ['razon_social', ''],
    ['pais_residencia', 'PANAMA'],
    ['es_fumador', 'No'],
    ['token', token],
    ['no_cotizacion', noCot],
    ['figura', '1'],
  ]);

  const gcAOk = Array.isArray(gcA) && gcA[0]?.Mensaje?.toLowerCase().includes('exitosa');
  console.log(`GC-A OK: ${gcAOk}`);
  if (Array.isArray(gcA) && gcA[0]) console.log(`  ${gcA[0].cod_cliente}: ${gcA[0].Mensaje}`);

  if (gcAOk) {
    // Continue with emission
    console.log('\n-- ClienteIgualContratante --');
    await soap('CIC', 'ClienteIgualContratante', [['token', token], ['no_cotizacion', noCot], ['respuesta', '1']]);

    console.log('\n-- GenerarNodocumento --');
    const genRes = await soap('GENDOC', 'GenerarNodocumento', [
      ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
      ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
    ]);
    const poliza = Array.isArray(genRes) ? genRes[0]?.no_documento : null;
    if (!poliza) { console.error('No poliza'); return; }
    console.log(`Poliza: ${poliza}`);

    const today = new Date();
    const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);

    console.log('\n-- EmitirDatos --');
    const emitRes = await soap('EMIT', 'EmitirDatos', [
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
      ['no_chasis', 'JTDKN3DU5A0000010'], ['nombre_conductor', 'JUAN'],
      ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', '000000'],
      ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
      ['vin', 'JTDKN3DU5A0000010'], ['no_motor', '1NZ0000010'], ['ano', '2025'],
      ['direccion', 'PANAMA'], ['observacion', ''], ['agencia', ''],
      ['direccion_cobros', 'PANAMA'], ['descuento', '0'],
      ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
      ['opcion', 'A'], ['no_cotizacion', noCot],
      ['cod_grupo', '00001'], ['nombre_grupo', 'SIN GRUPO'], ['token', token],
      ['nacionalidad', 'PANAMA'], ['pep', '002'], ['ocupacion', '001'],
      ['profesion', '1'], ['pais_residencia', 'PANAMA'], ['actividad_economica', '001'],
      ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
    ]);

    let emitOk = false, emitErr = null;
    if (typeof emitRes === 'string') emitErr = emitRes;
    else if (typeof emitRes === 'object' && emitRes) {
      if (emitRes.Respuesta) emitErr = typeof emitRes.Respuesta === 'string' ? emitRes.Respuesta : JSON.stringify(emitRes.Respuesta);
      for (const v of Object.values(emitRes)) { if (Array.isArray(v) && v[0]?.p1 === '0') { emitOk = true; break; } }
    }
    console.log(emitOk ? '\n🎉 EMISION EXITOSA!' : `\n❌ EMISION FALLIDA: ${emitErr}`);
    if (emitOk) {
      await soap('PRINT', 'ImpresionPoliza', [['token', token], ['no_poliza', poliza]]);
    }
  } else {
    // Test B: try without pais_residencia and es_fumador to see if error persists
    console.log('\n-- Test B: without pais_residencia/es_fumador (baseline) --');
    await soap('GC-B', 'GuardarCliente', [
      ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
      ['primer_nombre', 'MARIA'], ['segundo_nombre', ''], ['primer_apellido', 'GARCIA'],
      ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '01/01/1990'], ['sexo', 'F'],
      ['presidencia', 'PANAMA'], ['nacionalidad', 'PANAMA'],
      ['direccion_laboral', 'TEST'], ['calle', 'CALLE 1'], ['casa', '1'],
      ['barriada', 'TEST'], ['corregimiento', 'TEST'], ['direccion_cobros', 'TEST'],
      ['telefono1', '2221133'], ['telefono2', ''], ['celular', '60001111'],
      ['celular2', ''], ['email', 'maria@test.com'], ['apartado', ''],
      ['ced_prov', '8'], ['ced_inicial', '777'], ['tomo', '8888'],
      ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMA'],
      ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '008'],
      ['cli_forpago', '002'], ['cli_frepago', '002'], ['cli_lista', '002'],
      ['cli_fundacion', '002'], ['cli_pep1', '002'], ['asegurado_igual', '001'],
      ['asegurado_benef', '004'], ['asegurado_tercero', '006'], ['cli_coa', '0'],
      ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
      ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
      ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
    ]);
  }
}

main().catch(e => console.error('Fatal:', e));
