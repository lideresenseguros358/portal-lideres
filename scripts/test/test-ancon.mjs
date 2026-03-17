/**
 * ANCON API Connectivity Test
 * Tests: GenerarToken (SOAP), Estandar cotización, ListaMarcaModelos
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const REST_URL = 'https://app.asegurancon.com:4443/SFIntegrationServiceApi.Api';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function soapEnvelope(method, params) {
  const paramsXml = Object.entries(params)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros">
  <soap:Body>
    <tns:${method}>${paramsXml}</tns:${method}>
  </soap:Body>
</soap:Envelope>`;
}

async function soapCall(method, params) {
  console.log(`\n--- SOAP: ${method} ---`);
  const body = soapEnvelope(method, params);
  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `urn:server_otros#${method}`,
    },
    body,
  });
  const text = await res.text();
  console.log('Status:', res.status);
  
  // Extract JSON from SOAP response - try multiple patterns
  // Pattern 1: <return>JSON</return>
  let returnMatch = text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  // Pattern 2: <GenerarTokenReturn>JSON</...>
  if (!returnMatch) returnMatch = text.match(/<[^>]*Return[^>]*>([\s\S]*?)<\/[^>]*Return>/);
  // Pattern 3: <ns1:...Response>...<return>...</return></ns1:...Response>
  if (!returnMatch) returnMatch = text.match(/<ns1:\w+Response[^>]*>([\s\S]*?)<\/ns1:\w+Response>/);
  
  // Decode HTML entities
  let jsonStr = returnMatch ? returnMatch[1] : text;
  jsonStr = jsonStr
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
  
  // Try to find JSON inside the decoded string
  const jsonMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      console.log('Data:', JSON.stringify(data).substring(0, 600));
      return data;
    } catch {
      console.log('JSON parse failed, raw:', jsonMatch[1].substring(0, 400));
    }
  }
  
  console.log('Full response:', text.substring(0, 800));
  return text;
}

(async () => {
  // 1. GenerarToken
  const tokenResult = await soapCall('GenerarToken', {
    par_usuario: USUARIO,
    par_password: PASSWORD,
  });
  
  let token = null;
  if (typeof tokenResult === 'object') {
    // Could be { Login: [{ Token: "xxx", ... }] }
    const login = tokenResult?.Login?.[0] || tokenResult;
    token = login?.Token || login?.token;
    if (token) {
      console.log('\n✅ TOKEN:', token.substring(0, 30) + '...');
    }
  }
  
  if (!token) {
    console.log('\n❌ No token obtained. Trying alternative endpoint...');
    
    // Try REST endpoint login
    console.log('\n--- REST: get_login ---');
    try {
      const loginRes = await fetch(REST_URL + '/api/Entidad/get_login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: USUARIO, password: PASSWORD }),
      });
      console.log('Status:', loginRes.status);
      const loginData = await loginRes.text();
      console.log('Response:', loginData.substring(0, 400));
    } catch (e) {
      console.log('REST login error:', e.message);
    }
    return;
  }
  
  // 2. ValidarToken
  await soapCall('ValidarToken', { par_token: token });
  
  // 3. ListaMarcaModelos
  const marcas = await soapCall('ListaMarcaModelos', { token });
  
  // 4. Listaproductos
  await soapCall('Listaproductos', { token: 'UserAdmin' });
  
  // 5. Test Estandar cotización
  console.log('\n--- Estandar Cotización ---');
  const cotResult = await soapCall('Estandar', {
    token,
    cod_marca: '00122',
    cod_modelo: '10393',
    ano: '2024',
    suma_asegurada: '18000',
    cod_producto: '00312',
    cedula: '8-888-9999',
    nombre: 'TEST',
    apellido: 'PRUEBA',
    vigencia: 'A',
    email: 'test@lideresenseguros.com',
    tipo_persona: 'N',
    fecha_nac: '16/06/1994',
    nuevo: '0',
  });
  
  // Extract totals from cotización
  if (typeof cotResult === 'object' && cotResult.cotizacion) {
    const opciones = cotResult.cotizacion;
    for (const [key, coverages] of Object.entries(opciones)) {
      if (Array.isArray(coverages)) {
        const totals = coverages.find(c => c.Cobertura === 'Totales');
        const noCot = coverages.find(c => c.Cobertura === 'NoCotizacion');
        if (totals) console.log(`${key} Totals: a=$${totals.TarifaPrima_a} b=$${totals.TarifaPrima_b} c=$${totals.TarifaPrima_c}`);
        if (noCot) console.log(`${key} NoCotizacion: ${noCot.Descripcion1}`);
      }
    }
  }
  
  console.log('\n✅ ANCON API connectivity test complete');
})().catch(e => console.error('FATAL:', e.message));
