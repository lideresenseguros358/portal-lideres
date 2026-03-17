/**
 * EmitirDatos v9 — Test with ClienteIgualContratante BEFORE emission
 * Flow: Token → Estandar → ClienteIgualContratante → GenDoc → EmitirDatos
 * 
 * Also: try ConsultarCliente with different figura values to see client state
 * The ConsultarCliente previously failed with "No cotización errado" — maybe 
 * it needs the cotización without the "009-" prefix?
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function bld(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&oacute;/g,'ó').replace(/&aacute;/g,'á'); }

async function soap(label, method, pairs) {
  const body = bld(method, pairs);
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
  console.log('=== EMIT v9: ClienteIgualContratante flow ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // DT cotización
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

  // ConsultarCliente — try different formats
  console.log('--- ConsultarCliente ---');
  await soap('CC-1', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCot], ['figura', '1']]);
  // Try without 009- prefix
  const noCotShort = noCot.replace('009-', '');
  await soap('CC-short', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCotShort], ['figura', '1']]);

  // ClienteIgualContratante — try with respuesta='1' (SI from catalog)
  console.log('\n--- ClienteIgualContratante ---');
  const cic1 = await soap('CIC-1', 'ClienteIgualContratante', [['token', token], ['no_cotizacion', noCot], ['respuesta', '1']]);
  // Also try respuesta='001' (from ListaAseguradoContratante cod_clicontrol)
  const cic2 = await soap('CIC-001', 'ClienteIgualContratante', [['token', token], ['no_cotizacion', noCot], ['respuesta', '001']]);
  // Try 'SI'
  const cic3 = await soap('CIC-SI', 'ClienteIgualContratante', [['token', token], ['no_cotizacion', noCot], ['respuesta', 'SI']]);

  // GenerarNodocumento + EmitirDatos
  console.log('\n--- Emission ---');
  const gen = await soap('GEN', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
  if (!pol) { console.log('No poliza'); return; }

  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const vin = 'LJ11KBAC8F' + Date.now().toString().slice(-7);

  const emitRes = await soap('EMIT', 'EmitirDatos', [
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
    ['vin', vin], ['no_motor', 'D409' + Date.now().toString().slice(-8)], ['ano', '2025'],
    ['direccion', 'TEST'], ['observacion', 'TEST'], ['agencia', 'TEST'],
    ['direccion_cobros', 'TEST'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', '00001'], ['nombre_grupo', 'SIN GRUPO'], ['token', token],
    ['nacionalidad', 'PANAMÁ'], ['pep', '002|campo_pep'],
    ['ocupacion', '001'], ['profesion', '1'],
    ['pais_residencia', 'PANAMÁ'], ['actividad_economica', '001'],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);

  // Check result
  let ok = false;
  if (typeof emitRes === 'object' && emitRes) {
    for (const v of Object.values(emitRes)) {
      if (Array.isArray(v) && v[0]?.p1 === '0') { ok = true; break; }
    }
  }
  if (ok) {
    console.log('\n🎉 EMISION EXITOSA!');
    await soap('PRINT', 'ImpresionPoliza', [['token', token], ['no_poliza', pol]]);
  } else {
    console.log('\n❌ EMISION FALLIDA');
  }
}

main().catch(e => console.error('Fatal:', e));
