/**
 * Test GuardarCliente with different figura values, then test EmitirDatos without GuardarCliente
 * but with different pep/ocupacion/profesion values to isolate the FK constraint
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
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 500);
  console.log(`  [${label}] → ${JSON.stringify(parsed).substring(0, 350)}`);
  return parsed;
}

function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }

async function main() {
  console.log('═══ GUARDAR CLIENTE FIGURA TEST + FK ISOLATION ═══\n');

  const loginRes = await soap('LOGIN', 'GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  const token = loginRes?.Login?.[0]?.Token;
  if (!token) { console.error('Login failed'); return; }

  // Get cotización
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

  const gcBase = {
    tipo_persona: 'N', cod_producto: '07159', pasaporte: '',
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
    cod_actividad: '001', cod_clianiocon: '', razon_social: '', token, no_cotizacion: noCot,
  };

  // Test different figura values
  const figuras = ['contratante', 'asegurado', 'N', 'natural', '1', 'CONTRATANTE', 'NATURAL'];
  for (const fig of figuras) {
    console.log(`\n── GuardarCliente figura="${fig}" ──`);
    await soap(`GC-${fig}`, 'GuardarCliente', { ...gcBase, figura: fig });
  }

  // Now test EmitirDatos with minimal changes to isolate FK
  // The FK constraint may be from pep, nacionalidad, pais_residencia using names instead of codes
  console.log('\n\n═══ FK ISOLATION — EmitirDatos variants ═══\n');

  const genRes = await soap('GENDOC', 'GenerarNodocumento', {
    cod_compania: '001', cod_sucursal: '009', ano: '2026',
    cod_ramo: '002', cod_subramo: '001', token,
  });
  const poliza = Array.isArray(genRes) ? genRes[0]?.no_documento : genRes?.no_documento;
  if (!poliza) return;

  const today = new Date();
  const ny = new Date(today); ny.setFullYear(ny.getFullYear() + 1);

  // Base emission params — try with EMPTY optional fields
  console.log('\n── EmitirDatos: all compliance fields EMPTY ──');
  const emitRes = await soap('EMIT-EMPTY', 'EmitirDatos', {
    poliza,
    ramo_agt: 'AUTOMOVIL',
    vigencia_inicial: fmtDate(today), vigencia_final: fmtDate(ny),
    primer_nombre: 'JUAN', segundo_nombre: '', primer_apellido: 'PEREZ',
    segundo_apellido: '', apellido_casada: '', tipo_de_cliente: 'N',
    cedula: '8-888-9999', pasaporte: '', ruc: '',
    fecha_nacimiento: '16/06/1994', sexo: 'M',
    telefono_Residencial: '2221133', telefono_oficina: '2221133', telefono_celular: '60000001',
    email: 'test@test.com', tipo: 'POLIZA', fecha_de_registro: fmtDate(today),
    cantidad_de_pago: '10', codigo_producto_agt: '07159',
    nombre_producto: 'WEB - AUTORC', Responsable_de_cobro: 'CORREDOR',
    suma_asegurada: '0', codigo_acreedor: '', nombre_acreedor: '',
    cod_marca_agt: '00122', nombre_marca: 'TOYOTA',
    cod_modelo_agt: '10393', nombre_modelo: 'COROLLA',
    uso: 'PARTICULAR', codigo_color_agt: '001', nombre_color_agt: 'NO DEFINIDO',
    no_chasis: 'JTDKN3DU5A0000006', nombre_conductor: 'JUAN',
    apellido_conductor: 'PEREZ', sexo_conductor: 'M', placa: '000000',
    puertas: '4', pasajeros: '5', cilindros: '4',
    vin: 'JTDKN3DU5A0000006', no_motor: '1NZ0000006', ano: '2025',
    direccion: 'PANAMA', observacion: 'TEST', agencia: '',
    direccion_cobros: 'PANAMA', descuento: '0', fecha_primer_pago: fmtDate(today),
    cod_agente: '01009', opcion: 'A', no_cotizacion: noCot,
    cod_grupo: '00001', nombre_grupo: 'SIN GRUPO', token,
    // ALL compliance fields empty
    nacionalidad: '', pep: '', ocupacion: '', profesion: '',
    pais_residencia: '', actividad_economica: '',
    representante_legal: '', nombre_comercial: '', aviso_operacion: '',
  });

  // If still FK error, try without cod_grupo
  console.log('\n── EmitirDatos: without cod_grupo/nombre_grupo ──');
  const gen2 = await soap('GENDOC2', 'GenerarNodocumento', {
    cod_compania: '001', cod_sucursal: '009', ano: '2026',
    cod_ramo: '002', cod_subramo: '001', token,
  });
  const poliza2 = Array.isArray(gen2) ? gen2[0]?.no_documento : gen2?.no_documento;
  if (poliza2) {
    // Cotizacion 2
    const cot2 = await soap('COT2', 'Estandar', {
      token, cod_marca: '00122', cod_modelo: '10393', ano: '2025',
      suma_asegurada: '0', cod_producto: '07159',
      cedula: '8-888-9999', nombre: 'JUAN', apellido: 'PEREZ',
      vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
      fecha_nac: '16/06/1994', nuevo: '0', responsable: 'CORREDOR',
    });
    let noCot2 = null;
    if (cot2?.cotizacion) {
      for (const items of Object.values(cot2.cotizacion)) {
        if (Array.isArray(items)) {
          for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCot2 = it.Descripcion1; break; } }
        }
        if (noCot2) break;
      }
    }
    if (noCot2) {
      await soap('EMIT-NOGRP', 'EmitirDatos', {
        poliza: poliza2,
        ramo_agt: 'AUTOMOVIL',
        vigencia_inicial: fmtDate(today), vigencia_final: fmtDate(ny),
        primer_nombre: 'JUAN', segundo_nombre: '', primer_apellido: 'PEREZ',
        segundo_apellido: '', apellido_casada: '', tipo_de_cliente: 'N',
        cedula: '8-888-9999', pasaporte: '', ruc: '',
        fecha_nacimiento: '16/06/1994', sexo: 'M',
        telefono_Residencial: '2221133', telefono_oficina: '2221133', telefono_celular: '60000001',
        email: 'test@test.com', tipo: 'POLIZA', fecha_de_registro: fmtDate(today),
        cantidad_de_pago: '10', codigo_producto_agt: '07159',
        nombre_producto: 'WEB - AUTORC', Responsable_de_cobro: 'CORREDOR',
        suma_asegurada: '0', codigo_acreedor: '', nombre_acreedor: '',
        cod_marca_agt: '00122', nombre_marca: 'TOYOTA',
        cod_modelo_agt: '10393', nombre_modelo: 'COROLLA',
        uso: 'PARTICULAR', codigo_color_agt: '001', nombre_color_agt: 'NO DEFINIDO',
        no_chasis: 'JTDKN3DU5A0000007', nombre_conductor: 'JUAN',
        apellido_conductor: 'PEREZ', sexo_conductor: 'M', placa: '000000',
        puertas: '4', pasajeros: '5', cilindros: '4',
        vin: 'JTDKN3DU5A0000007', no_motor: '1NZ0000007', ano: '2025',
        direccion: 'PANAMA', observacion: 'TEST', agencia: '',
        direccion_cobros: 'PANAMA', descuento: '0', fecha_primer_pago: fmtDate(today),
        cod_agente: '01009', opcion: 'A', no_cotizacion: noCot2,
        // No cod_grupo at all — leave them out
        token,
        nacionalidad: '', pep: '0', ocupacion: '', profesion: '',
        pais_residencia: '', actividad_economica: '',
        representante_legal: '', nombre_comercial: '', aviso_operacion: '',
      });
    }
  }
}

main().catch(e => console.error('Fatal:', e));
