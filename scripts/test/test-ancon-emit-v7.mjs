/**
 * EmitirDatos v7 — Use catalog NAMES for compliance fields
 * Doc says: "nacionalidad: (Disponible en ListaPais)" — meaning use catalog values
 * Also fetch all catalogs first to get correct values.
 * 
 * Flow: Token → Catalogs → Estandar → GenDoc → EmitirDatos
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

async function main() {
  console.log('=== EMIT v7: Catalog values + correct formats ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // Fetch all compliance catalogs
  console.log('\n--- Catalogs ---');
  const pais = await soap('PAIS', 'ListaPais', [['token', token]]);
  const pep = await soap('PEP', 'ListaPep', [['token', token]]);
  const ocup = await soap('OCUP', 'ListaOcupacion', [['token', token]]);
  const prof = await soap('PROF', 'ListaProfesion', [['token', token]]);
  const activ = await soap('ACTIV', 'ListaActividad', [['token', token]]);

  // Show first few entries of each
  if (Array.isArray(pais)) console.log('  PAIS first 3:', pais.slice(0,3).map(p => `${p.cod_paisres}|${p.nombre}`).join(', '));
  if (Array.isArray(pep)) console.log('  PEP:', pep.slice(0,3).map(p => `${p.cod_pep}|${p.nombre}`).join(', '));
  if (Array.isArray(ocup)) console.log('  OCUP first 3:', ocup.slice(0,3).map(p => `${p.cod_ocup || p.cod_ocupacion}|${p.nombre}`).join(', '));
  if (Array.isArray(prof)) console.log('  PROF first 3:', prof.slice(0,3).map(p => `${p.cod_prof || p.cod_profesion || Object.values(p)[0]}|${p.nombre}`).join(', '));
  if (Array.isArray(activ)) console.log('  ACTIV first 3:', activ.slice(0,3).map(p => `${p.cod_activ || p.cod_actividad || Object.values(p)[0]}|${p.nombre}`).join(', '));

  // Find PANAMA in country list
  let paisPanama = null;
  if (Array.isArray(pais)) {
    paisPanama = pais.find(p => p.nombre?.includes('PANAMA') || p.nombre?.includes('PANAM'));
    console.log('  PANAMA entry:', JSON.stringify(paisPanama));
  }

  // Cotización
  console.log('\n--- Cotización ---');
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
  console.log(`  NoCot: ${noCot}\n`);
  if (!noCot) return;

  // GenDoc
  const gen = await soap('GEN', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol = Array.isArray(gen) ? gen[0]?.no_documento : null;
  if (!pol) return;
  console.log(`  Poliza: ${pol}\n`);

  const today = new Date(); const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);
  const vin = 'LJ11KBAC8F' + Date.now().toString().slice(-7);

  // Get catalog codes for PANAMA
  const paisCode = paisPanama?.cod_paisres || '170';
  const paisName = paisPanama?.nombre || 'PANAMA';

  // Test A: Use catalog CODES (numbers)
  console.log('--- Test A: catalog codes ---');
  const rA = await soap('EMIT-A', 'EmitirDatos', [
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
    ['vin', vin], ['no_motor', 'D40958326F7A' + Date.now().toString().slice(-4)], ['ano', '2025'],
    ['direccion', 'TEST'], ['observacion', 'TEST'], ['agencia', 'TEST'],
    ['direccion_cobros', 'TEST'], ['descuento', '0'],
    ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
    ['opcion', 'A'], ['no_cotizacion', noCot],
    ['cod_grupo', '00001'], ['nombre_grupo', 'SIN GRUPO'], ['token', token],
    ['nacionalidad', paisCode], ['pep', '002'],
    ['ocupacion', '001'], ['profesion', '1'],
    ['pais_residencia', paisCode], ['actividad_economica', '001'],
    ['representante_legal', 'TEXTO'], ['nombre_comercial', 'TEXTO'], ['aviso_operacion', 'TEXTO'],
  ]);

  // Test B: Use catalog NAMES
  console.log('\n--- Test B: catalog names ---');
  const gen2 = await soap('GEN2', 'GenerarNodocumento', [
    ['cod_compania', '001'], ['cod_sucursal', '009'], ['ano', '2026'],
    ['cod_ramo', '002'], ['cod_subramo', '001'], ['token', token],
  ]);
  const pol2 = Array.isArray(gen2) ? gen2[0]?.no_documento : null;
  if (pol2) {
    const vin2 = 'LJ22KBAC8F' + Date.now().toString().slice(-7);
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
      ['cantidad_de_pago', '10'], ['codigo_producto_agt', '07159'],
      ['nombre_producto', 'WEB - AUTORC'], ['Responsable_de_cobro', 'CORREDOR'],
      ['suma_asegurada', '0'], ['codigo_acreedor', ''], ['nombre_acreedor', ''],
      ['cod_marca_agt', '00122'], ['nombre_marca', 'TOYOTA'],
      ['cod_modelo_agt', '10393'], ['nombre_modelo', 'COROLLA'],
      ['uso', 'PARTICULAR'], ['codigo_color_agt', '001'], ['nombre_color_agt', 'NO DEFINIDO'],
      ['no_chasis', vin2], ['nombre_conductor', 'JUAN'],
      ['apellido_conductor', 'PEREZ'], ['sexo_conductor', 'M'], ['placa', '987655'],
      ['puertas', '4'], ['pasajeros', '5'], ['cilindros', '4'],
      ['vin', vin2], ['no_motor', 'D40958326F7B' + Date.now().toString().slice(-4)], ['ano', '2025'],
      ['direccion', 'TEST'], ['observacion', 'TEST'], ['agencia', 'TEST'],
      ['direccion_cobros', 'TEST'], ['descuento', '0'],
      ['fecha_primer_pago', fmtDate(today)], ['cod_agente', '01009'],
      ['opcion', 'A'], ['no_cotizacion', noCot],
      ['cod_grupo', '00001'], ['nombre_grupo', 'SIN GRUPO'], ['token', token],
      ['nacionalidad', paisName], ['pep', 'NO'],
      ['ocupacion', 'ABOGADO'], ['profesion', 'ABOGADO'],
      ['pais_residencia', paisName], ['actividad_economica', 'ABOGADO'],
      ['representante_legal', ''], ['nombre_comercial', ''], ['aviso_operacion', ''],
    ]);
  }
}

main().catch(e => console.error('Fatal:', e));
