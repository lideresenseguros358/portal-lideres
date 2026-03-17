/**
 * FULL FLOW TEST — following ANCON documentation exactly.
 * 
 * From docs:
 * - EmitirDatos: cod_grupo='00001', nombre_grupo='SIN GRUPO'
 * - nacionalidad & pais_residencia: from ListaPais (nombre values)
 * - pep: from ListaPep (cod_pep: 0=no, 1=si)
 * - ocupacion: from ListaOcupacion (cod_ocupacion)
 * - profesion: from ListaProfesion (cod_profesion)
 * - actividad_economica: from ListaActividad (cod_actividad)
 * - Inspection flow: ListadoInspeccion → EnlazarInspeccion BEFORE EmitirDatos
 * 
 * Expected flow:
 * 1. GenerarToken
 * 2. Estandar (cotización)
 * 3. GuardarCliente (register client)
 * 4. Upload photos (REST API)
 * 5. ListadoInspeccion → find inspection
 * 6. EnlazarInspeccion → link to cotización
 * 7. GenerarNodocumento
 * 8. EmitirDatos
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
  console.log('=== FULL FLOW TEST ===\n');

  // 1. Login
  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // Fetch catalog values (from docs: "Disponible en ListaXxx")
  console.log('\n--- Catalog values ---');
  const pepData = await soap('PEP', 'ListaPep', [['token', token]]);
  // Doc says cod_pep: 0=no, 1=si
  console.log('  PEP data:', JSON.stringify(pepData).substring(0, 200));

  const ocupData = await soap('OCUP', 'ListaOcupacion', [['token', token]]);
  console.log('  First ocupacion:', Array.isArray(ocupData) ? JSON.stringify(ocupData[0]) : 'N/A');

  const profData = await soap('PROF', 'ListaProfesion', [['token', token]]);
  console.log('  First profesion:', Array.isArray(profData) ? JSON.stringify(profData[0]) : 'N/A');

  const actData = await soap('ACT', 'ListaActividad', [['token', token]]);
  console.log('  First actividad:', Array.isArray(actData) ? JSON.stringify(actData[0]) : 'N/A');

  const paisData = await soap('PAIS', 'ListaPais', [['token', token]]);
  const panama = Array.isArray(paisData) ? paisData.find(p => p.nombre?.includes('PANAM')) : null;
  console.log('  Panama entry:', JSON.stringify(panama));

  // 2. Cotización DT
  console.log('\n--- Cotización DT ---');
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
  console.log(`NoCot: ${noCot}`);
  if (!noCot) return;

  // 3. GuardarCliente
  console.log('\n--- GuardarCliente ---');
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
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ]);

  // 4. Check inspection
  console.log('\n--- Inspection Flow ---');
  const insp = await soap('INSP', 'ListadoInspeccion', [['token', token], ['cod_agente', '01009']]);
  console.log('  Inspections:', JSON.stringify(insp).substring(0, 400));

  // 5. SubirDocumentos — check what docs are needed
  console.log('\n--- SubirDocumentos (list) ---');
  const docs = await soap('DOCS', 'SubirDocumentos', [['token', token], ['tipo', 'N']]);
  console.log('  Required docs:', JSON.stringify(docs).substring(0, 400));

  // 6. ListadoExpedientes
  console.log('\n--- ListadoExpedientes ---');
  const exp = await soap('EXP', 'ListadoExpedientes', [
    ['token', token], ['cod_agente', '01009'], ['usuario', '01009'],
  ]);
  console.log('  Expedientes:', JSON.stringify(exp).substring(0, 400));

  // 7. GenerarNodocumento
  console.log('\n--- GenerarNodocumento ---');
  const gen = await soap('GEN', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
  console.log(`  Poliza: ${pol}`);
  if (!pol) return;

  // 8. EmitirDatos — with CORRECT values from documentation
  console.log('\n--- EmitirDatos (doc-correct values) ---');
  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const fmtDate = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const vin = 'LJ11K' + Date.now().toString(36).toUpperCase();

  // Use ListaPais name for nacionalidad and pais_residencia
  const paisNombre = panama?.nombre || 'PANAMA';
  
  // Use cod values from catalogs
  const pepCode = Array.isArray(pepData) ? (pepData.find(p => p.nombre?.toLowerCase() === 'no')?.cod_pep ?? '0') : '0';
  const ocupCode = Array.isArray(ocupData) ? ocupData[0]?.cod_ocupacion ?? '001' : '001';
  const profCode = Array.isArray(profData) ? profData[0]?.cod_profesion ?? '1' : '1';
  const actCode = Array.isArray(actData) ? actData[0]?.cod_actividad ?? '001' : '001';

  console.log(`  Using: pais=${paisNombre}, pep=${pepCode}, ocup=${ocupCode}, prof=${profCode}, act=${actCode}`);

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
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', '987654'],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', vin], ['no_motor', 'D' + vin], ['ano', '2025'],
    ['direccion', 'TEST'], ['observacion', 'TEST'], ['agencia', 'TEST'],
    ['direccion_cobros', 'TEST'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', '00001'], ['nombre_grupo', 'SIN GRUPO'],
    ['token', token],
    ['nacionalidad', paisNombre],
    ['pep', pepCode],
    ['ocupacion', ocupCode],
    ['profesion', profCode],
    ['pais_residencia', paisNombre],
    ['actividad_economica', actCode],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);

  // Also try with CC product for comparison
  console.log('\n\n--- CC product comparison ---');
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
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const polCC = Array.isArray(genCC) ? genCC[0]?.no_documento : null;
  if (!polCC) return;
  const vinCC = 'LJ22K' + Date.now().toString(36).toUpperCase();

  await soap('EMIT-CC', 'EmitirDatos', [
    ['poliza', polCC], ['ramo_agt', 'AUTOMOVIL'],
    ['vigencia_inicial', fmtDate(today)], ['vigencia_final', fmtDate(ny)],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', 'VIDAL'], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', 'TORRES'], ['apellido_casada', ''], ['tipo_de_cliente', 'N'],
    ['cedula', '8-888-9999'], ['pasaporte', ''], ['ruc', ''],
    ['fecha_nacimiento', '16/06/1994'], ['sexo', 'M'],
    ['telefono_Residencial', '2221133'], ['telefono_oficina', '2221133'],
    ['telefono_celular', '66112233'], ['email', 'test@test.com'],
    ['tipo', 'POLIZA'], ['fecha_de_registro', fmtDate(today)],
    ['cantidad_de_pago', '10'], ['codigo_producto_agt', '00312'],
    ['nombre_producto', 'AUTO COMPLETA'], ['Responsable_de_cobro', 'CORREDOR'],
    ['suma_asegurada', '21500'], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
    ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
    ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
    ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
    ['no_chasis', vinCC], ['nombre_conductor', 'JUAN'],
    ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', '987654'],
    ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
    ['vin', vinCC], ['no_motor', 'D' + vinCC], ['ano', '2025'],
    ['direccion', 'TEST'], ['observacion', 'TEST'], ['agencia', 'TEST'],
    ['direccion_cobros', 'TEST'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCotCC],
    ['cod_grupo', '00001'], ['nombre_grupo', 'SIN GRUPO'],
    ['token', token],
    ['nacionalidad', paisNombre],
    ['pep', pepCode],
    ['ocupacion', ocupCode],
    ['profesion', profCode],
    ['pais_residencia', paisNombre],
    ['actividad_economica', actCode],
    ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
  ]);
}

main().catch(e => console.error('Fatal:', e));
