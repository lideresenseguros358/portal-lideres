/**
 * Test ListadoInspeccion with correct namespace (urn:emision) and correct soapAction.
 * WSDL shows: soapAction="urn:emision#Listado_inspeccion" with namespace="urn:emision"
 * Previous tests used urn:server_otros which only works for catalog/quote methods.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

async function soapNS(label, method, pairs, ns = 'urn:server_otros', action = null) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  const soapAction = action || `${ns}#${method}`;
  const body = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${ns}"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction }, body });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`[${label}] ns=${ns} action=${soapAction}`);
  console.log(`  -> ${JSON.stringify(parsed).substring(0, 400)}`);
  return parsed;
}

async function main() {
  console.log('=== NAMESPACE TEST ===\n');

  // Get token with urn:server_otros (this works)
  const lr = await soapNS('TOKEN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]], 'urn:server_otros');
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // Test 1: ListadoInspeccion with urn:server_otros (old way — fails)
  console.log('\n--- Test 1: urn:server_otros namespace ---');
  const t1 = await soapNS('INSP-1', 'ListadoInspeccion', 
    [['token', token], ['cod_agente', '01009']], 
    'urn:server_otros');

  // Get new token (previous one may be consumed)
  const lr2 = await soapNS('TOKEN2', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]], 'urn:server_otros');
  const token2 = lr2?.Login?.[0]?.Token;

  // Test 2: ListadoInspeccion with urn:emision namespace + correct soapAction
  console.log('\n--- Test 2: urn:emision namespace ---');
  const t2 = await soapNS('INSP-2', 'ListadoInspeccion',
    [['token', token2], ['cod_agente', '01009']],
    'urn:emision',
    'urn:emision#Listado_inspeccion');

  // Get new token
  const lr3 = await soapNS('TOKEN3', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]], 'urn:server_otros');
  const token3 = lr3?.Login?.[0]?.Token;

  // Test 3: ListadoInspeccion with urn:emision namespace but action as ListadoInspeccion
  console.log('\n--- Test 3: urn:emision + action=ListadoInspeccion ---');
  const t3 = await soapNS('INSP-3', 'ListadoInspeccion',
    [['token', token3], ['cod_agente', '01009']],
    'urn:emision',
    'urn:emision#ListadoInspeccion');

  // Get new token
  const lr4 = await soapNS('TOKEN4', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]], 'urn:server_otros');
  const token4 = lr4?.Login?.[0]?.Token;

  // Test 4: Try with urn:server_otros but action from WSDL
  console.log('\n--- Test 4: urn:server_otros + action=urn:emision#Listado_inspeccion ---');
  const t4 = await soapNS('INSP-4', 'ListadoInspeccion',
    [['token', token4], ['cod_agente', '01009']],
    'urn:server_otros',
    'urn:emision#Listado_inspeccion');

  // Get new token
  const lr5 = await soapNS('TOKEN5', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]], 'urn:server_otros');
  const token5 = lr5?.Login?.[0]?.Token;

  // Test 5: SubirDocumentos with urn:emision
  console.log('\n--- Test 5: SubirDocumentos with urn:emision ---');
  const t5 = await soapNS('DOCS', 'SubirDocumentos',
    [['token', token5], ['tipo', 'N']],
    'urn:emision',
    'urn:emision#Subir_documentos');

  // Get new token
  const lr6 = await soapNS('TOKEN6', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]], 'urn:server_otros');
  const token6 = lr6?.Login?.[0]?.Token;

  // Test 6: ListadoExpedientes with urn:emision
  console.log('\n--- Test 6: ListadoExpedientes with urn:emision ---');
  const t6 = await soapNS('EXP', 'ListadoExpedientes',
    [['token', token6], ['cod_agente', '01009'], ['usuario', '01009']],
    'urn:emision',
    'urn:emision#Listado_expedientes');

  // Test 7: param order — token FIRST then cod_agente
  const lr7 = await soapNS('TOKEN7', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]], 'urn:server_otros');
  const token7 = lr7?.Login?.[0]?.Token;
  console.log('\n--- Test 7: token first, then cod_agente ---');
  const t7 = await soapNS('INSP-7', 'ListadoInspeccion',
    [['token', token7], ['cod_agente', '01009']],
    'urn:emision');
}

main().catch(e => console.error('Fatal:', e));
