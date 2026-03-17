/**
 * Test the corrected ANCON emission flow:
 * - GuardarCliente (will fail with WSDL bug, but we continue)
 * - ClienteIgualContratante
 * - GenerarNodocumento
 * - ListadoInspeccion → EnlazarInspeccion (if available)
 * - EmitirDatos with cod_grupo=00001, nombre_grupo=SIN GRUPO
 * 
 * Tests both DT and CC products to compare errors.
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
  console.log(`  [${label}] ${JSON.stringify(parsed).substring(0, 400)}`);
  return parsed;
}

async function getToken() {
  const lr = await soap('TOKEN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  return lr?.Login?.[0]?.Token;
}

async function testProduct(label, codProducto, nombreProducto, sumaAseg) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}: ${nombreProducto} (${codProducto})`);
  console.log(`${'='.repeat(60)}`);

  // Step 1: Fresh token + cotización
  let token = await getToken();
  const cr = await soap('COT', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', String(sumaAseg)], ['cod_producto', codProducto], ['cedula', '8-888-9999'],
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
  console.log(`  NoCot: ${noCot}`);
  if (!noCot) { console.log('  FAILED: No cotización'); return; }

  // Step 2: GuardarCliente (expected to fail with WSDL bug)
  const gc = await soap('GC', 'GuardarCliente', [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', 'PANAMA'], ['nacionalidad', 'PANAMA'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMA'],
    ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', ''], ['cod_clianiocon', ''], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);
  const gcMsg = Array.isArray(gc) ? gc[0]?.Mensaje : String(gc);
  console.log(`  GC result: ${gcMsg}`);

  // Step 3: CIC
  const cic = await soap('CIC', 'ClienteIgualContratante', [
    ['token', token], ['no_cotizacion', noCot], ['respuesta', '001'],
  ]);

  // Step 4: Fresh token for inspection
  token = await getToken();

  // Step 5: ListadoInspeccion
  const insp = await soap('INSP', 'ListadoInspeccion', [['cod_agente', '01009'], ['token', token]]);
  const inspections = Array.isArray(insp) ? insp : [];
  console.log(`  Inspections available: ${inspections.length}`);

  // Step 6: GenerarNodocumento
  const isCC = ['00312', '10394', '10395', '10602', '00318'].includes(codProducto);
  const codRamo = isCC ? '001' : '002';
  const gen = await soap('GEN', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', codRamo], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
  console.log(`  Poliza: ${pol}`);
  if (!pol) { console.log('  FAILED: No poliza number'); return; }

  // Step 7: Fresh token for EmitirDatos
  token = await getToken();

  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const vin = 'TEST' + Date.now().toString(36).toUpperCase();

  const emit = await soap('EMIT', 'EmitirDatos', [
    ['poliza', pol], ['ramo_agt', 'AUTOMOVIL'],
    ['vigencia_inicial', fmt(today)], ['vigencia_final', fmt(ny)],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['apellido_casada', ''], ['tipo_de_cliente', 'N'],
    ['cedula', '8-888-9999'], ['pasaporte', ''], ['ruc', ''],
    ['fecha_nacimiento', '16/06/1994'], ['sexo', 'M'],
    ['telefono_Residencial', '2221133'], ['telefono_oficina', ''],
    ['telefono_celular', '60000001'], ['email', 'test@test.com'],
    ['tipo', 'POLIZA'], ['fecha_de_registro', fmt(today)],
    ['cantidad_de_pago', '10'], ['codigo_producto_agt', codProducto],
    ['nombre_producto', nombreProducto], ['Responsable_de_cobro', 'CORREDOR'],
    ['suma_asegurada', String(sumaAseg)], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
    ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
    ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
    ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
    ['no_chasis', vin], ['nombre_conductor', 'JUAN'],
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', '987654'],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', vin], ['no_motor', 'D' + vin], ['ano', '2025'],
    ['direccion', 'PANAMA'], ['observacion', ''], ['agencia', ''],
    ['direccion_cobros', 'PANAMA'], ['descuento', '0'],
    ['fecha_primer_pago', fmt(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', '00001'], ['nombre_grupo', 'SIN GRUPO'],
    ['token', token],
    ['nacionalidad', 'PANAMA'],
    ['pep', '002|campo_pep'],
    ['ocupacion', '001'],
    ['profesion', '1'],
    ['pais_residencia', 'PANAMA'],
    ['actividad_economica', '001'],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);

  // Parse result
  const emitStr = typeof emit === 'string' ? emit : JSON.stringify(emit);
  if (emitStr.includes('"p1":"0"')) {
    console.log(`\n  *** ${label} EMISSION SUCCEEDED! ***`);
  } else if (emitStr.includes('pendiente de inspecci')) {
    console.log(`\n  ${label}: Blocked by inspection requirement`);
  } else if (emitStr.includes('fk_ref')) {
    console.log(`\n  ${label}: FK error — GuardarCliente must succeed first`);
  } else {
    console.log(`\n  ${label}: Other error — ${emitStr.substring(0, 300)}`);
  }
}

async function main() {
  console.log('=== CORRECTED FLOW TEST ===');
  console.log('Changes: cod_grupo=00001, nombre_grupo=SIN GRUPO, inspection for ALL products\n');

  await testProduct('DT', '07159', 'WEB - AUTORC', '0');
  await testProduct('CC', '00312', 'AUTO COMPLETA', '21500');
  
  console.log('\n\nDONE.');
}

main().catch(e => console.error('Fatal:', e));
