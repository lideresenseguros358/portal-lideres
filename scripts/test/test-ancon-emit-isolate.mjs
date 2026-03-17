/**
 * Isolate FK constraint — test EmitirDatos with different cod_grupo values
 * and with GuardarCliente properly calling with different product codes.
 * ALL in a single token.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function buildEnvelope(method, params) {
  const xml = Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => `<${k}>${esc(String(v))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&ntilde;/g,'ñ').replace(/&oacute;/g,'ó'); }

async function soap(label, method, params) {
  const body = buildEnvelope(method, params);
  const t0 = Date.now();
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const elapsed = Date.now() - t0;
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`  [${label}] (${elapsed}ms) → ${JSON.stringify(parsed).substring(0, 350)}`);
  return parsed;
}

function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }

async function main() {
  console.log('═══ FK CONSTRAINT ISOLATION ═══\n');

  const loginRes = await soap('LOGIN', 'GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  const token = loginRes?.Login?.[0]?.Token;
  if (!token) { console.error('Login failed'); return; }

  // Cotización
  const cotRes = await soap('COT', 'Estandar', {
    token, cod_marca: '00122', cod_modelo: '10393', ano: '2025',
    suma_asegurada: '0', cod_producto: '07159',
    cedula: '8-888-9999', nombre: 'JUAN', apellido: 'PEREZ',
    vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
    fecha_nac: '16/06/1994', nuevo: '0', responsable: 'CORREDOR',
  });
  let noCot = null;
  if (cotRes?.cotizacion) {
    for (const items of Object.values(cotRes.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCot = it.Descripcion1; break; } }
      }
      if (noCot) break;
    }
  }
  console.log(`  NoCot: ${noCot}\n`);
  if (!noCot) return;

  // GuardarCliente — try with ramo code '2' (AUTOMOVIL) as cod_producto
  // The doc says "cod_producto: 41" — 41 might be an internal sequential ID
  // Let's try '2' since AUTOMOVIL is ramo 002
  console.log('── GuardarCliente tests ──');
  
  // Test 1: cod_producto='2'
  const gc1 = await soap('GC-2', 'GuardarCliente', {
    tipo_persona: 'N', cod_producto: '2', pasaporte: '',
    primer_nombre: 'JUAN', segundo_nombre: '', primer_apellido: 'PEREZ',
    segundo_apellido: '', casada: '', fecha_nac: '16/06/1994', sexo: 'M',
    presidencia: 'PANAMÁ', nacionalidad: 'PANAMÁ', direccion_laboral: 'TEST',
    calle: 'CALLE 50', casa: '1', barriada: 'EL CANGREJO', corregimiento: 'BELLA VISTA',
    direccion_cobros: 'PANAMA', telefono1: '2221133', telefono2: '', celular: '60000001',
    celular2: '', email: 'test@test.com', apartado: '', ced_prov: '8', ced_inicial: '888',
    tomo: '9999', folio: '', asiento: '', ocupacion: '001', pais_nacimiento: 'PANAMÁ',
    ofondo: '001', monto_ingreso: '001', prov_residencia: '008', cli_forpago: '002',
    cli_frepago: '002', cli_lista: '002', cli_fundacion: '002', cli_pep1: '002',
    asegurado_igual: '001', asegurado_benef: '004', asegurado_tercero: '006',
    cli_coa: '0', dv: '', rlegal: '', ncomercial: '', aoperacion: '',
    cod_actividad: '001', cod_clianiocon: '', razon_social: '', token,
    no_cotizacion: noCot, figura: '1',
  });

  // Test 2: cod_producto='41'
  const gc2 = await soap('GC-41', 'GuardarCliente', {
    tipo_persona: 'N', cod_producto: '41', pasaporte: '',
    primer_nombre: 'JUAN', segundo_nombre: '', primer_apellido: 'PEREZ',
    segundo_apellido: '', casada: '', fecha_nac: '16/06/1994', sexo: 'M',
    presidencia: 'PANAMÁ', nacionalidad: 'PANAMÁ', direccion_laboral: 'TEST',
    calle: 'CALLE 50', casa: '1', barriada: 'EL CANGREJO', corregimiento: 'BELLA VISTA',
    direccion_cobros: 'PANAMA', telefono1: '2221133', telefono2: '', celular: '60000001',
    celular2: '', email: 'test@test.com', apartado: '', ced_prov: '8', ced_inicial: '888',
    tomo: '9999', folio: '', asiento: '', ocupacion: '001', pais_nacimiento: 'PANAMÁ',
    ofondo: '001', monto_ingreso: '001', prov_residencia: '008', cli_forpago: '002',
    cli_frepago: '002', cli_lista: '002', cli_fundacion: '002', cli_pep1: '002',
    asegurado_igual: '001', asegurado_benef: '004', asegurado_tercero: '006',
    cli_coa: '0', dv: '', rlegal: '', ncomercial: '', aoperacion: '',
    cod_actividad: '001', cod_clianiocon: '', razon_social: '', token,
    no_cotizacion: noCot, figura: '1',
  });

  // Check if GC worked
  const gc1ok = Array.isArray(gc1) && gc1[0]?.Mensaje?.toLowerCase().includes('exitosa');
  const gc2ok = Array.isArray(gc2) && gc2[0]?.Mensaje?.toLowerCase().includes('exitosa');
  console.log(`  GC with '2': ${gc1ok ? 'SUCCESS' : JSON.stringify(gc1?.[0]?.Mensaje || gc1).substring(0, 100)}`);
  console.log(`  GC with '41': ${gc2ok ? 'SUCCESS' : JSON.stringify(gc2?.[0]?.Mensaje || gc2).substring(0, 100)}`);

  // If any GC succeeded, try ClienteIgualContratante
  if (gc1ok || gc2ok) {
    console.log('\n── ClienteIgualContratante ──');
    await soap('CIC', 'ClienteIgualContratante', { token, no_cotizacion: noCot, respuesta: '1' });
  }

  // Now test EmitirDatos variations
  const today = new Date();
  const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);

  const emitBase = {
    ramo_agt: 'AUTOMOVIL',
    vigencia_inicial: fmtDate(today), vigencia_final: fmtDate(ny),
    primer_nombre: 'JUAN', segundo_nombre: '', primer_apellido: 'PEREZ',
    segundo_apellido: '', apellido_casada: '', tipo_de_cliente: 'N',
    cedula: '8-888-9999', pasaporte: '', ruc: '',
    fecha_nacimiento: '16/06/1994', sexo: 'M',
    telefono_Residencial: '2221133', telefono_oficina: '2221133', telefono_celular: '60000001',
    email: 'test@test.com', tipo: 'POLIZA', fecha_de_registro: fmtDate(today),
    codigo_producto_agt: '07159', nombre_producto: 'WEB - AUTORC',
    Responsable_de_cobro: 'CORREDOR', suma_asegurada: '0',
    codigo_acreedor: '', nombre_acreedor: '',
    cod_marca_agt: '00122', nombre_marca: 'TOYOTA',
    cod_modelo_agt: '10393', nombre_modelo: 'COROLLA',
    uso: 'PARTICULAR', codigo_color_agt: '001', nombre_color_agt: 'NO DEFINIDO',
    nombre_conductor: 'JUAN', apellido_conductor: 'PEREZ', sexo_conductor: 'M',
    placa: '000000', puertas: '4', pasajeros: '5', cilindros: '4',
    ano: '2025', direccion: 'PANAMA', observacion: 'TEST', agencia: '',
    direccion_cobros: 'PANAMA', descuento: '0', fecha_primer_pago: fmtDate(today),
    cod_agente: '01009', opcion: 'A', no_cotizacion: noCot,
    token, nacionalidad: 'PANAMÁ', pep: '002', ocupacion: '001', profesion: '1',
    pais_residencia: 'PANAMÁ', actividad_economica: '001',
    representante_legal: '', nombre_comercial: '', aviso_operacion: '',
  };

  // Variation A: no cod_grupo at all
  console.log('\n── EmitirDatos: NO cod_grupo ──');
  const gen1 = await soap('GEN-A', 'GenerarNodocumento', { cod_compania: '001', cod_sucursal: '009', ano: '2026', cod_ramo: '002', cod_subramo: '001', token });
  const pol1 = Array.isArray(gen1) ? gen1[0]?.no_documento : null;
  if (pol1) {
    await soap('EMIT-A', 'EmitirDatos', { ...emitBase, poliza: pol1, no_chasis: 'JTDKN3DU5A1000001', vin: 'JTDKN3DU5A1000001', no_motor: '1NZA000001', cantidad_de_pago: '1' });
  }

  // Variation B: cod_grupo='' (empty string)
  console.log('\n── EmitirDatos: cod_grupo="" ──');
  const gen2 = await soap('GEN-B', 'GenerarNodocumento', { cod_compania: '001', cod_sucursal: '009', ano: '2026', cod_ramo: '002', cod_subramo: '001', token });
  const pol2 = Array.isArray(gen2) ? gen2[0]?.no_documento : null;
  if (pol2) {
    await soap('EMIT-B', 'EmitirDatos', { ...emitBase, poliza: pol2, no_chasis: 'JTDKN3DU5A1000002', vin: 'JTDKN3DU5A1000002', no_motor: '1NZA000002', cod_grupo: '', nombre_grupo: '', cantidad_de_pago: '1' });
  }

  // Variation C: cod_grupo='00001' + cantidad_de_pago='1' (contado)
  console.log('\n── EmitirDatos: cod_grupo=00001, cantidad_de_pago=1 ──');
  const gen3 = await soap('GEN-C', 'GenerarNodocumento', { cod_compania: '001', cod_sucursal: '009', ano: '2026', cod_ramo: '002', cod_subramo: '001', token });
  const pol3 = Array.isArray(gen3) ? gen3[0]?.no_documento : null;
  if (pol3) {
    await soap('EMIT-C', 'EmitirDatos', { ...emitBase, poliza: pol3, no_chasis: 'JTDKN3DU5A1000003', vin: 'JTDKN3DU5A1000003', no_motor: '1NZA000003', cod_grupo: '00001', nombre_grupo: 'SIN GRUPO', cantidad_de_pago: '1' });
  }
}

main().catch(e => console.error('Fatal:', e));
