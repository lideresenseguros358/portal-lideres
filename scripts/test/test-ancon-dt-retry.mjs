/**
 * Test: Does Estandar work with a SECOND token after the first fails?
 * This mimics the app's anconCall retry logic.
 * Also: if we get a fresh cotización, attempt full DT emission.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';
const COD_AGENTE = '01009';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function buildEnvelope(method, params) {
  const xml = Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => `<${k}>${esc(String(v))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&ntilde;/g,'ñ').replace(/&oacute;/g,'ó'); }

async function soap(method, params) {
  const body = buildEnvelope(method, params);
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  if (!m) return text.substring(0, 800);
  const decoded = decode(m[1]);
  try { return JSON.parse(decoded); } catch { return decoded; }
}

async function getToken() {
  const r = await soap('GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  return r?.Login?.[0]?.Token;
}

function fmtDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }

async function main() {
  console.log('═══ TEST: Estandar with token retry + fresh DT emission ═══\n');

  // Token 1
  const token1 = await getToken();
  console.log(`Token 1: ${token1?.substring(0,20)}...`);

  // Estandar attempt 1
  console.log('\n── Estandar attempt 1 (token 1) ──');
  const cot1 = await soap('Estandar', {
    cod_marca: '00122', cod_modelo: '10393', ano: '2025',
    suma_asegurada: '0', cod_producto: '07159',
    cedula: '8-888-9999', nombre: 'JUAN', apellido: 'PEREZ',
    vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
    fecha_nac: '16/06/1994', nuevo: '0', token: token1,
  });
  console.log('Result:', JSON.stringify(cot1).substring(0, 300));

  const isInactive1 = typeof cot1 === 'string' && cot1.includes('Token Inactivo');
  
  if (isInactive1) {
    console.log('\n⚠ Token Inactivo on first attempt. Generating NEW token...');
    
    // Token 2
    const token2 = await getToken();
    console.log(`Token 2: ${token2?.substring(0,20)}...`);

    // Validate token 2
    const valid2 = await soap('ValidarToken', { par_token: token2 });
    console.log('ValidarToken:', JSON.stringify(valid2).substring(0, 150));

    // Estandar attempt 2
    console.log('\n── Estandar attempt 2 (token 2) ──');
    const cot2 = await soap('Estandar', {
      cod_marca: '00122', cod_modelo: '10393', ano: '2025',
      suma_asegurada: '0', cod_producto: '07159',
      cedula: '8-888-9999', nombre: 'JUAN', apellido: 'PEREZ',
      vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
      fecha_nac: '16/06/1994', nuevo: '0', token: token2,
    });
    console.log('Result:', JSON.stringify(cot2).substring(0, 400));

    const isInactive2 = typeof cot2 === 'string' && cot2.includes('Token Inactivo');

    if (isInactive2) {
      console.log('\n❌ Estandar STILL returns Token Inactivo with fresh token 2.');
      console.log('This is a confirmed ANCON-side issue.\n');
      
      // Try a third time just to be absolutely sure
      const token3 = await getToken();
      console.log(`Token 3: ${token3?.substring(0,20)}...`);
      const cot3 = await soap('Estandar', {
        cod_marca: '00122', cod_modelo: '10393', ano: '2025',
        suma_asegurada: '0', cod_producto: '07159',
        cedula: '8-888-9999', nombre: 'JUAN', apellido: 'PEREZ',
        vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
        fecha_nac: '16/06/1994', nuevo: '0', token: token3,
      });
      console.log('Estandar attempt 3:', JSON.stringify(cot3).substring(0, 300));
      
      // Also try CC product (00312) to see if the issue is specific to DT
      console.log('\n── Estandar with CC product 00312 (token 3) ──');
      const cotCC = await soap('Estandar', {
        cod_marca: '00122', cod_modelo: '10393', ano: '2025',
        suma_asegurada: '15000', cod_producto: '00312',
        cedula: '8-888-9999', nombre: 'JUAN', apellido: 'PEREZ',
        vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
        fecha_nac: '16/06/1994', nuevo: '0', token: token3,
      });
      console.log('Result CC:', JSON.stringify(cotCC).substring(0, 400));

      // Try catalog methods to see if they work
      console.log('\n── ListaPep (simple catalog, token 3) ──');
      const pep = await soap('ListaPep', { token: token3 });
      console.log('ListaPep:', JSON.stringify(pep).substring(0, 200));
      
      console.log('\n── ListaMarcaModelos (token 3) ──');
      const marcas = await soap('ListaMarcaModelos', { token: token3 });
      console.log('ListaMarcaModelos:', JSON.stringify(marcas).substring(0, 200));
      
    } else {
      // Token 2 worked! Extract cotización and proceed to emission
      console.log('\n✓ Estandar worked with token 2!');
      await attemptEmission(cot2, token2);
    }
  } else {
    console.log('\n✓ Estandar worked with token 1!');
    await attemptEmission(cot1, token1);
  }
}

async function attemptEmission(cotRes, token) {
  // Extract no_cotizacion
  let noCot = null;
  if (Array.isArray(cotRes)) {
    for (const item of cotRes) {
      if (item.Cobertura === 'NoCotizacion') { noCot = item.Descripcion1; break; }
    }
  }
  if (!noCot) { console.log('Could not extract no_cotizacion from:', JSON.stringify(cotRes).substring(0, 200)); return; }
  console.log(`Cotización: ${noCot}`);

  // Generate poliza
  const genRes = await soap('GenerarNodocumento', { cod_compania: '001', cod_sucursal: '009', ano: '2026', cod_ramo: '002', cod_subramo: '001', token });
  const poliza = Array.isArray(genRes) ? genRes[0]?.no_documento : genRes?.no_documento;
  if (!poliza) { console.log('Failed to generate poliza:', JSON.stringify(genRes)); return; }
  console.log(`Póliza: ${poliza}`);

  // Emit
  const today = new Date(), ny = new Date(today); ny.setFullYear(ny.getFullYear()+1);
  const emitRes = await soap('EmitirDatos', {
    poliza, ramo_agt: 'AUTOMOVIL', vigencia_inicial: fmtDate(today), vigencia_final: fmtDate(ny),
    primer_nombre: 'JUAN', segundo_nombre: '', primer_apellido: 'PEREZ', segundo_apellido: '', apellido_casada: '',
    tipo_de_cliente: 'N', cedula: '8-888-9999', pasaporte: '', ruc: '',
    fecha_nacimiento: '16/06/1994', sexo: 'M', telefono_Residencial: '', telefono_oficina: '', telefono_celular: '6000-0001',
    email: 'test@test.com', tipo: 'POLIZA', fecha_de_registro: fmtDate(today), cantidad_de_pago: '1',
    codigo_producto_agt: '07159', nombre_producto: 'WEB - AUTORC', Responsable_de_cobro: 'CORREDOR',
    suma_asegurada: '0', codigo_acreedor: '', nombre_acreedor: '',
    cod_marca_agt: '00122', nombre_marca: 'TOYOTA', cod_modelo_agt: '10393', nombre_modelo: 'COROLLA',
    uso: 'PARTICULAR', codigo_color_agt: '001', nombre_color_agt: 'NO DEFINIDO',
    no_chasis: 'TEST00DT17032026002', nombre_conductor: 'JUAN', apellido_conductor: 'PEREZ', sexo_conductor: 'M',
    placa: 'TST456', puertas: '4', pasajeros: '5', cilindros: '4',
    vin: 'TEST00DT17032026002', no_motor: 'TESTMOTOR002', ano: '2025',
    direccion: 'PANAMA', observacion: '', agencia: '', direccion_cobros: 'PANAMA', descuento: '0',
    fecha_primer_pago: fmtDate(today), cod_agente: COD_AGENTE, opcion: 'A',
    no_cotizacion: noCot, cod_grupo: '00001', nombre_grupo: 'SIN GRUPO', token,
    nacionalidad: 'PANAMA', pep: '0', ocupacion: '', profesion: '', pais_residencia: '',
    actividad_economica: '', representante_legal: '', nombre_comercial: '', aviso_operacion: '',
  });
  console.log('EmitirDatos response:', JSON.stringify(emitRes).substring(0, 400));

  // Check if success
  if (typeof emitRes === 'object' && emitRes !== null) {
    for (const val of Object.values(emitRes)) {
      if (Array.isArray(val) && val[0]?.p1 === '0') {
        console.log('\n🎉 EMISIÓN EXITOSA!');
        // Print
        const pr = await soap('ImpresionPoliza', { no_poliza: poliza, token });
        console.log('ImpresionPoliza:', JSON.stringify(pr).substring(0, 300));
        return;
      }
    }
  }
  console.log('❌ Emisión fallida');
}

main().catch(e => console.error('Fatal:', e));
