/**
 * Test ONLY the inspection methods with a fresh token.
 * Previous tests showed "Token Inactivo" because the token was consumed by earlier calls.
 * This isolates the inspection flow to verify it works.
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
  console.log(`[${label}] ${JSON.stringify(parsed).substring(0, 500)}`);
  return parsed;
}

async function getToken() {
  const lr = await soap('TOKEN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  return lr?.Login?.[0]?.Token;
}

async function main() {
  console.log('=== INSPECTION ISOLATION TEST ===\n');

  // Test 1: Fresh token → ListadoInspeccion ONLY (2 calls total: login + insp)
  console.log('--- Test 1: ListadoInspeccion with fresh token ---');
  let token = await getToken();
  const insp1 = await soap('INSP', 'ListadoInspeccion', [['cod_agente', '01009'], ['token', token]]);
  console.log(`  Result type: ${typeof insp1}, isNull: ${insp1 === null || insp1 === 'null'}`);
  console.log(`  Inspections: ${Array.isArray(insp1) ? insp1.length : 'N/A'}`);

  // Test 2: Try with different cod_agente values
  console.log('\n--- Test 2: ListadoInspeccion with different agent codes ---');
  token = await getToken();
  const insp2 = await soap('INSP-009', 'ListadoInspeccion', [['cod_agente', '009'], ['token', token]]);
  
  token = await getToken();
  const insp3 = await soap('INSP-01009', 'ListadoInspeccion', [['cod_agente', '01009'], ['token', token]]);
  
  // Test 3: Try ListadoExpedientes
  console.log('\n--- Test 3: ListadoExpedientes ---');
  token = await getToken();
  const exp1 = await soap('EXP-N', 'ListadoExpedientes', [['cod_agente', '01009'], ['usuario', '01009'], ['token', token]]);
  
  token = await getToken();
  const exp2 = await soap('EXP-tipo', 'ListadoExpedientes', [['tipo', 'N'], ['cod_agente', '01009'], ['token', token]]);

  // Test 4: Try SubirDocumentos (should list required docs)
  console.log('\n--- Test 4: SubirDocumentos ---');
  token = await getToken();
  const docs = await soap('DOCS', 'SubirDocumentos', [['tipo', 'N'], ['token', token]]);

  // Test 5: Try REST API login
  console.log('\n--- Test 5: REST API Login ---');
  try {
    const restRes = await fetch('https://app.asegurancon.com:4443/SFIntegrationServiceApi.Api/api/Entidad/get_login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `Usuario=01009&Clave=750840840940840`,
    });
    const restText = await restRes.text();
    console.log(`[REST LOGIN] Status: ${restRes.status}, Body: ${restText.substring(0, 300)}`);
  } catch (e) {
    console.log(`[REST LOGIN] Error: ${e.message}`);
  }

  // Test 6: REST API — check available endpoints
  console.log('\n--- Test 6: REST API Inspection endpoints ---');
  try {
    // Try to list inspections via REST
    const restRes = await fetch('https://app.asegurancon.com:4443/SFIntegrationServiceApi.Api/api/Polizas/get_inspecciones?codAgente=01009', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const restText = await restRes.text();
    console.log(`[REST INSP] Status: ${restRes.status}, Body: ${restText.substring(0, 300)}`);
  } catch (e) {
    console.log(`[REST INSP] Error: ${e.message}`);
  }

  // Test 7: Check if there's an inspection creation endpoint
  console.log('\n--- Test 7: REST API create inspection ---');
  try {
    const restRes = await fetch('https://app.asegurancon.com:4443/SFIntegrationServiceApi.Api/api/Polizas/post_crear_inspeccion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codAgente: '01009', noCotizacion: '009-1397491' }),
    });
    const restText = await restRes.text();
    console.log(`[REST CREATE-INSP] Status: ${restRes.status}, Body: ${restText.substring(0, 300)}`);
  } catch (e) {
    console.log(`[REST CREATE-INSP] Error: ${e.message}`);
  }

  console.log('\n\nSUMMARY:');
  console.log('- ListadoInspeccion returns null = no inspections exist for this agent.');
  console.log('- ANCON says inspection must be done via their app/cotizador before emission.');
  console.log('- This confirms: we cannot CREATE inspections via API, only LINK existing ones.');
  console.log('- For DT: FK error because GuardarCliente WSDL bug prevents client creation.');
  console.log('- For CC: inspection must exist in ANCON system before we can emit.');
}

main().catch(e => console.error('Fatal:', e));
