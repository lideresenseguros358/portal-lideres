// Test EmitirDatos with the exact same params as the app sends
const url = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';

function buildEnvelope(method, params) {
  const paramsXml = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<${k}>${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros">
  <soap:Body>
    <tns:${method}>${paramsXml}</tns:${method}>
  </soap:Body>
</soap:Envelope>`;
}

function decode(text) {
  return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function soapCall(method, params) {
  const body = buildEnvelope(method, params);
  if (method === 'EmitirDatos') {
    console.log('Body length:', body.length);
    console.log('Params count:', Object.keys(params).length);
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` },
    body,
  });
  const xml = await res.text();
  const dataMatch = xml.match(/<data[^>]*>([\s\S]*?)<\/data>/);
  if (!dataMatch) {
    const retMatch = xml.match(/<return[^>]*>([\s\S]*?)<\/return>/);
    return retMatch ? decode(retMatch[1]) : xml.substring(0, 500);
  }
  const decoded = decode(dataMatch[1]);
  try { return JSON.parse(decoded); } catch { return decoded; }
}

async function test() {
  // Get token
  const login = await soapCall('GenerarToken', { par_usuario: '01009', par_password: '750840840940840' });
  const token = login?.Login?.[0]?.Token;
  console.log('Token:', token?.substring(0, 20) + '...');
  if (!token) return;

  // Generate doc number
  const genDoc = await soapCall('GenerarNodocumento', {
    cod_compania: '001', cod_sucursal: '009', ano: '2026',
    cod_ramo: '002', cod_subramo: '001', token,
  });
  const poliza = Array.isArray(genDoc) ? genDoc[0]?.no_documento : 'FAILED';
  console.log('Poliza:', poliza);

  // Test A: EmitirDatos with ONLY the params from the working direct test (no extras)
  console.log('\n=== Test A: EmitirDatos with MINIMAL params ===');
  const resultA = await soapCall('EmitirDatos', {
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
    opcion: 'A', no_cotizacion: '009-1396557',
    cod_grupo: '00001', nombre_grupo: 'SIN GRUPO',
    token, nacionalidad: 'PANAMA', pep: '0',
  });
  console.log('Test A result:', JSON.stringify(resultA).substring(0, 500));

  // Test B: Same but with extra empty KYC fields (occupacion, profesion, etc)
  console.log('\n=== Test B: EmitirDatos with EXTRA KYC params ===');
  const resultB = await soapCall('EmitirDatos', {
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
    opcion: 'A', no_cotizacion: '009-1396557',
    cod_grupo: '00001', nombre_grupo: 'SIN GRUPO',
    token, nacionalidad: 'PANAMA', pep: '0',
    ocupacion: '', profesion: '', pais_residencia: '',
    actividad_economica: '', representante_legal: '',
    nombre_comercial: '', aviso_operacion: '',
  });
  console.log('Test B result:', JSON.stringify(resultB).substring(0, 500));
}

test().catch(e => console.error('Error:', e.message));
