// Test ANCON full emission flow directly via SOAP
const url = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';

function buildEnvelope(method, params) {
  const paramsXml = Object.entries(params)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join('');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros">',
    '  <soap:Body>',
    `    <tns:${method}>${paramsXml}</tns:${method}>`,
    '  </soap:Body>',
    '</soap:Envelope>',
  ].join('\n');
}

function decode(text) {
  return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function soapCall(method, params) {
  const body = buildEnvelope(method, params);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` },
    body,
  });
  const xml = await res.text();
  const dataMatch = xml.match(/<data[^>]*>([\s\S]*?)<\/data>/);
  if (!dataMatch) {
    const retMatch = xml.match(/<return[^>]*>([\s\S]*?)<\/return>/);
    return retMatch ? decode(retMatch[1]) : xml;
  }
  const decoded = decode(dataMatch[1]);
  try { return JSON.parse(decoded); } catch { return decoded; }
}

async function test() {
  // 1. Get token
  console.log('=== Step 1: GenerarToken ===');
  const login = await soapCall('GenerarToken', { par_usuario: '01009', par_password: '750840840940840' });
  const token = login?.Login?.[0]?.Token;
  console.log('Token:', token ? token.substring(0, 20) + '...' : 'FAILED');
  if (!token) { console.error('Login failed:', JSON.stringify(login)); return; }

  // 1b. Test token reuse — can we call GenerarNodocumento twice with same token?
  console.log('\n=== Step 1b: Token reuse test ===');
  const test1 = await soapCall('GenerarNodocumento', {
    cod_compania: '001', cod_sucursal: '009', ano: '2026',
    cod_ramo: '002', cod_subramo: '001', token,
  });
  const doc1 = Array.isArray(test1) ? test1[0]?.no_documento : 'FAILED';
  console.log('Call 1 with same token:', doc1);

  const test2 = await soapCall('GenerarNodocumento', {
    cod_compania: '001', cod_sucursal: '009', ano: '2026',
    cod_ramo: '002', cod_subramo: '001', token,
  });
  const doc2 = Array.isArray(test2) ? test2[0]?.no_documento : JSON.stringify(test2).substring(0, 100);
  console.log('Call 2 with same token:', doc2);

  // 2. ListadoInspeccion — check available inspections
  console.log('\n=== Step 2: ListadoInspeccion ===');
  const inspections = await soapCall('ListadoInspeccion', { cod_agente: '01009', token });
  console.log('Inspections:', JSON.stringify(inspections).substring(0, 800));

  // 3. Get fresh DT cotización (07159)
  console.log('\n=== Step 3: Fresh DT Cotización (07159) ===');
  const cotDT = await soapCall('Estandar', {
    cod_marca: '00122', cod_modelo: '10393', ano: '2025',
    suma_asegurada: '0', cod_producto: '07159',
    cedula: '8-888-9999', nombre: 'COTIZACION', apellido: 'WEB',
    vigencia: 'A', email: 'cot@test.com', tipo_persona: 'N',
    fecha_nac: '16/06/1994', nuevo: '0', token,
  });
  // Find noCotizacion from options
  let noCotDT = '';
  if (cotDT && typeof cotDT === 'object') {
    const str = JSON.stringify(cotDT);
    const m = str.match(/no_cotizacion['":\s]+(['"0-9\-]+)/);
    if (m) noCotDT = m[1].replace(/['"]/g, '');
  }
  console.log('DT noCotizacion:', noCotDT);

  // 4. GenerarNodocumento
  console.log('\n=== Step 4: GenerarNodocumento ===');
  const genDoc = await soapCall('GenerarNodocumento', {
    cod_compania: '001', cod_sucursal: '009', ano: '2026',
    cod_ramo: '002', cod_subramo: '001', token,
  });
  console.log('GenDoc:', JSON.stringify(genDoc));
  const poliza = Array.isArray(genDoc) ? genDoc[0]?.no_documento : genDoc?.no_documento;
  if (!poliza) { console.error('No policy number'); return; }
  console.log('Poliza:', poliza);

  // 5. If inspections exist, try EnlazarInspeccion
  if (Array.isArray(inspections) && inspections.length > 0) {
    const inspId = inspections[0].id_inspeccion || inspections[0].inspeccion || inspections[0].id || Object.values(inspections[0])[0];
    console.log('\n=== Step 5: EnlazarInspeccion ===');
    console.log('Linking inspection', inspId, 'to cotización', noCotDT || '009-1396557');
    const link = await soapCall('EnlazarInspeccion', {
      inspeccion: String(inspId), cotizacion: noCotDT || '009-1396557', token,
    });
    console.log('Link result:', JSON.stringify(link).substring(0, 500));
  } else {
    console.log('\n=== Step 5: No inspections available to link ===');
  }

  // 6. EmitirDatos
  console.log('\n=== Step 6: EmitirDatos ===');
  // Get fresh token for emission
  const login2 = await soapCall('GenerarToken', { par_usuario: '01009', par_password: '750840840940840' });
  const token2 = login2?.Login?.[0]?.Token || token;

  const emision = await soapCall('EmitirDatos', {
    poliza, ramo_agt: 'AUTOMOVIL',
    vigencia_inicial: '17/03/2026', vigencia_final: '17/03/2027',
    primer_nombre: 'JUAN', segundo_nombre: 'CARLOS',
    primer_apellido: 'PEREZ', segundo_apellido: 'GOMEZ',
    apellido_casada: '', tipo_de_cliente: 'N',
    cedula: '8-888-9999', pasaporte: '', ruc: '',
    fecha_nacimiento: '16/06/1994', sexo: 'M',
    telefono_Residencial: '', telefono_oficina: '', telefono_celular: '6000-0001',
    email: 'test@test.com', tipo: 'POLIZA',
    fecha_de_registro: '17/03/2026', cantidad_de_pago: '1',
    codigo_producto_agt: '07159', nombre_producto: 'SOBAT BASICO TALLER',
    Responsable_de_cobro: 'CORREDOR', suma_asegurada: '0',
    codigo_acreedor: '', nombre_acreedor: '',
    cod_marca_agt: '00122', nombre_marca: 'TOYOTA',
    cod_modelo_agt: '10393', nombre_modelo: 'COROLLA',
    uso: 'PARTICULAR', codigo_color_agt: '001', nombre_color_agt: 'NO DEFINIDO',
    no_chasis: 'JTDKN3DU5A0000001', nombre_conductor: 'JUAN',
    apellido_conductor: 'PEREZ', sexo_conductor: 'M',
    placa: 'ABC123', puertas: '4', pasajeros: '5', cilindros: '4',
    vin: 'JTDKN3DU5A0000001', no_motor: '1NZ0000001', ano: '2025',
    direccion: 'PANAMA', observacion: '', agencia: '',
    direccion_cobros: 'PANAMA', descuento: '0',
    fecha_primer_pago: '17/03/2026', cod_agente: '01009',
    opcion: 'A', no_cotizacion: noCotDT || '009-1396557',
    cod_grupo: '00001', nombre_grupo: 'SIN GRUPO',
    token: token2, nacionalidad: 'PANAMA', pep: '0',
    ocupacion: '', profesion: '', pais_residencia: '',
    actividad_economica: '', representante_legal: '',
    nombre_comercial: '', aviso_operacion: '',
  });
  console.log('Emision result:', JSON.stringify(emision).substring(0, 500));

  // 7. ImpresionPoliza (with fresh token)
  const login3 = await soapCall('GenerarToken', { par_usuario: '01009', par_password: '750840840940840' });
  const token3 = login3?.Login?.[0]?.Token || token2;
  console.log('\n=== Step 7: ImpresionPoliza ===');
  const print = await soapCall('ImpresionPoliza', { poliza, token: token3 });
  console.log('Print result:', JSON.stringify(print).substring(0, 500));
}

test().catch(e => console.error('Error:', e.message));
