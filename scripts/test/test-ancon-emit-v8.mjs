/**
 * EmitirDatos v8 — Use EXACT catalog values:
 * - pep: '002|campo_pep' (exact from ListaPep)
 * - nacionalidad: 'PANAMÁ' (exact from ListaPais, with accent)
 * - pais_residencia: 'PANAMÁ' (exact from ListaPais)
 * - ocupacion: '001' (from ListaOcupacion)
 * - profesion: '1' (from ListaProfesion)
 * - actividad_economica: '001' (from ListaActividad)
 * 
 * ALSO: Try with CC product 00312 to see if that product works (doc example uses it)
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function bld(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&#039;/g,"'").replace(/&ntilde;/g,'ñ').replace(/&oacute;/g,'ó').replace(/&aacute;/g,'á').replace(/&eacute;/g,'é').replace(/&iacute;/g,'í').replace(/&uacute;/g,'ú'); }

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

async function main() {
  console.log('=== EMIT v8: Exact catalog values ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // DT cotización
  const cr = await soap('COT-DT', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '0'], ['cod_producto', '07159'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]);
  let noCotDT = null;
  if (cr?.cotizacion) {
    for (const items of Object.values(cr.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCotDT = it.Descripcion1; break; } }
      }
      if (noCotDT) break;
    }
  }
  console.log(`  DT NoCot: ${noCotDT}\n`);

  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);

  // Test A: DT with EXACT pep format '002|campo_pep' and PANAMÁ with accent
  if (noCotDT) {
    const gen = await soap('GEN-A', 'GenerarNodocumento', [
      ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
      ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
    ]);
    const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
    if (pol) {
      const vin = 'LJ11KBAC8F' + Date.now().toString().slice(-7);
      console.log('\n--- Test A: DT, pep=002|campo_pep, nacionalidad=PANAMÁ ---');
      await soap('EMIT-A', 'EmitirDatos', [
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
        ['opcion', 'A'], ['no_cotizacion', noCotDT],
        ['cod_grupo', '00001'], ['nombre_grupo', 'SIN GRUPO'], ['token', token],
        ['nacionalidad', 'PANAMÁ'], ['pep', '002|campo_pep'],
        ['ocupacion', '001'], ['profesion', '1'],
        ['pais_residencia', 'PANAMÁ'], ['actividad_economica', '001'],
        ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
      ]);
    }
  }

  // Test B: CC product 00312 (doc example product) with same car
  console.log('\n--- CC Cotización ---');
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
  console.log(`  CC NoCot: ${noCotCC}\n`);

  if (noCotCC) {
    const gen2 = await soap('GEN-B', 'GenerarNodocumento', [
      ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
      ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
    ]);
    const pol2 = Array.isArray(gen2) ? gen2[0]?.no_documento : null;
    if (pol2) {
      const vin2 = 'LJ22KBAC8F' + Date.now().toString().slice(-7);
      console.log('--- Test B: CC 00312, pep=002|campo_pep, sum=21500 ---');
      await soap('EMIT-B', 'EmitirDatos', [
        ['poliza', pol2], ['ramo_agt', 'AUTOMOVIL'],
        ['vigencia_inicial', fmtDate(today)], ['vigencia_final', fmtDate(ny)],
        ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
        ['segundo_apellido', ''], ['apellido_casada', ''], ['tipo_de_cliente', 'N'],
        ['cedula', '8-888-9999'], ['pasaporte', ''], ['ruc', ''],
        ['fecha_nacimiento', '16/06/1994'], ['sexo', 'M'],
        ['telefono_Residencial', '2221133'], ['telefono_oficina', '2221133'],
        ['telefono_celular', '60000001'], ['email', 'test@test.com'],
        ['tipo', 'POLIZA'], ['fecha_de_registro', fmtDate(today)],
        ['cantidad_de_pago', '10'], ['codigo_producto_agt', '00312'],
        ['nombre_producto', 'AUTO COMPLETA'], ['Responsable_de_cobro', 'CORREDOR'],
        ['suma_asegurada', '21500'], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
        ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
        ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
        ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
        ['no_chasis', vin2], ['nombre_conductor', 'JUAN'],
        ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', '987655'],
        ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
        ['vin', vin2], ['no_motor', 'D410' + Date.now().toString().slice(-8)], ['ano', '2025'],
        ['direccion', 'TEST'], ['observacion', 'TEST'], ['agencia', 'TEST'],
        ['direccion_cobros', 'TEST'], ['descuento', '0'],
        ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
        ['opcion', 'A'], ['no_cotizacion', noCotCC],
        ['cod_grupo', '00001'], ['nombre_grupo', 'SIN GRUPO'], ['token', token],
        ['nacionalidad', 'PANAMÁ'], ['pep', '002|campo_pep'],
        ['ocupacion', '001'], ['profesion', '1'],
        ['pais_residencia', 'PANAMÁ'], ['actividad_economica', '001'],
        ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
      ]);
    }
  }
}

main().catch(e => console.error('Fatal:', e));
