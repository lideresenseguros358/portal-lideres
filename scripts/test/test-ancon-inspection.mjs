// Test ListadoInspeccion and EnlazarInspeccion with various param combos
const url = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';

function buildEnvelope(method, params) {
  const paramsXml = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<${k}>${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${paramsXml}</tns:${method}></soap:Body></soap:Envelope>`;
}

function decode(text) {
  return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function soapCall(method, params) {
  const body = buildEnvelope(method, params);
  console.log(`  [SOAP] ${method} params: ${JSON.stringify(Object.keys(params))}`);
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
  // Get fresh token
  const login = await soapCall('GenerarToken', { par_usuario: '01009', par_password: '750840840940840' });
  const token = login?.Login?.[0]?.Token;
  console.log('Token:', token?.substring(0, 20) + '...');
  if (!token) return;

  // Test ListadoInspeccion with various param combos
  console.log('\n=== Test 1: ListadoInspeccion with cod_agente + token ===');
  const r1 = await soapCall('ListadoInspeccion', { cod_agente: '01009', token });
  console.log('Result:', JSON.stringify(r1).substring(0, 300));

  console.log('\n=== Test 2: ListadoInspeccion with agente + token ===');
  const r2 = await soapCall('ListadoInspeccion', { agente: '01009', token });
  console.log('Result:', JSON.stringify(r2).substring(0, 300));

  console.log('\n=== Test 3: ListadoInspeccion with cod_corredor + token ===');
  const r3 = await soapCall('ListadoInspeccion', { cod_corredor: '01009', token });
  console.log('Result:', JSON.stringify(r3).substring(0, 300));

  console.log('\n=== Test 4: ListadoInspeccion with token only ===');
  const r4 = await soapCall('ListadoInspeccion', { token });
  console.log('Result:', JSON.stringify(r4).substring(0, 300));

  // Test EnlazarInspeccion — see if we can link without knowing inspection ID
  console.log('\n=== Test 5: EnlazarInspeccion with cotizacion + token ===');
  const r5 = await soapCall('EnlazarInspeccion', { no_cotizacion: '009-1396557', token });
  console.log('Result:', JSON.stringify(r5).substring(0, 300));

  console.log('\n=== Test 6: EnlazarInspeccion with cotizacion + inspeccion=0 + token ===');
  const r6 = await soapCall('EnlazarInspeccion', { inspeccion: '0', cotizacion: '009-1396557', token });
  console.log('Result:', JSON.stringify(r6).substring(0, 300));

  // Check if the ImpresionPoliza method name is correct
  console.log('\n=== Test 7: ImpresionPoliza with no_poliza ===');
  const r7 = await soapCall('ImpresionPoliza', { no_poliza: '0226-03657-09', token });
  console.log('Result:', JSON.stringify(r7).substring(0, 300));
}

test().catch(e => console.error('Error:', e.message));
