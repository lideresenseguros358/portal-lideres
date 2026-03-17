/**
 * Test Estandar with fixes derived from WSDL analysis:
 * 1. Add missing "responsable" param (required by WSDL)
 * 2. Try correct namespace urn:emision 
 * 3. Try correct SOAPAction urn:emision#Estandar
 * 4. Try param order matching WSDL: token FIRST
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Original envelope (urn:server_otros namespace)
function buildOld(method, params) {
  const xml = Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => `<${k}>${esc(String(v))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}

// New envelope matching WSDL: urn:emision namespace, RPC/encoded style
function buildWsdl(method, params) {
  const xml = Object.entries(params).filter(([,v]) => v != null)
    .map(([k,v]) => `<${k} xsi:type="xsd:string">${esc(String(v))}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:tns="urn:emision" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/"><soap:Body><tns:${method} xmlns:tns="urn:emision" SOAP-ENC:root="1">${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}

function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

async function soapRaw(label, envelope, soapAction) {
  console.log(`\n── ${label} ──`);
  console.log(`  SOAPAction: ${soapAction}`);
  const t0 = Date.now();
  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction },
    body: envelope,
  });
  const text = await res.text();
  const elapsed = Date.now() - t0;
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 500);
  
  const isErr = typeof parsed === 'string' && parsed.includes('Token Inactivo');
  console.log(`  ${isErr ? '❌' : '✓'} ${elapsed}ms → ${JSON.stringify(parsed).substring(0, 300)}`);
  return parsed;
}

async function getToken() {
  const body = buildOld('GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'urn:server_otros#GenerarToken' }, body });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/);
  if (!m) return null;
  const d = decode(m[1]);
  try { const j = JSON.parse(d); return j?.Login?.[0]?.Token; } catch { return null; }
}

async function main() {
  console.log('═══ ANCON Estandar — WSDL-Based Fix Tests ═══');
  
  const token = await getToken();
  console.log(`Token: ${token?.substring(0,20)}...`);
  if (!token) { console.error('Login failed'); return; }

  // WSDL says Estandar params in order: token, cod_marca, cod_modelo, ano, suma_asegurada, 
  // cod_producto, cedula, nombre, apellido, vigencia, email, tipo_persona, fecha_nac, nuevo, responsable
  const baseParams = {
    token,
    cod_marca: '00122',
    cod_modelo: '10393',
    ano: '2025',
    suma_asegurada: '0',
    cod_producto: '07159',
    cedula: '8-888-9999',
    nombre: 'JUAN',
    apellido: 'PEREZ',
    vigencia: 'A',
    email: 'test@test.com',
    tipo_persona: 'N',
    fecha_nac: '16/06/1994',
    nuevo: '0',
  };

  // Test 1: Original (no responsable, old namespace) — baseline, expect failure
  await soapRaw(
    'TEST 1: Old namespace, NO responsable',
    buildOld('Estandar', baseParams),
    'urn:server_otros#Estandar'
  );

  // Test 2: Add responsable=CORREDOR with old namespace
  await soapRaw(
    'TEST 2: Old namespace + responsable=CORREDOR',
    buildOld('Estandar', { ...baseParams, responsable: 'CORREDOR' }),
    'urn:server_otros#Estandar'
  );

  // Test 3: WSDL namespace + responsable=CORREDOR + correct SOAPAction
  await soapRaw(
    'TEST 3: WSDL namespace (urn:emision) + responsable=CORREDOR + correct SOAPAction',
    buildWsdl('Estandar', { ...baseParams, responsable: 'CORREDOR' }),
    'urn:emision#Estandar'
  );

  // Test 4: WSDL namespace + responsable=CORREDOR + OLD SOAPAction
  await soapRaw(
    'TEST 4: WSDL namespace + responsable=CORREDOR + old SOAPAction',
    buildWsdl('Estandar', { ...baseParams, responsable: 'CORREDOR' }),
    'urn:server_otros#Estandar'
  );

  // Test 5: Old namespace + responsable=CORREDOR + WSDL SOAPAction
  await soapRaw(
    'TEST 5: Old namespace + responsable=CORREDOR + WSDL SOAPAction',
    buildOld('Estandar', { ...baseParams, responsable: 'CORREDOR' }),
    'urn:emision#Estandar'
  );

  // Test 6: Try responsable='' (empty string)
  await soapRaw(
    'TEST 6: Old namespace + responsable="" (empty)',
    buildOld('Estandar', { ...baseParams, responsable: '' }),
    'urn:server_otros#Estandar'
  );

  // Test 7: Try with token as FIRST param (WSDL order) + responsable
  const orderedParams = {
    token,
    cod_marca: '00122', cod_modelo: '10393', ano: '2025',
    suma_asegurada: '0', cod_producto: '07159',
    cedula: '8-888-9999', nombre: 'JUAN', apellido: 'PEREZ',
    vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
    fecha_nac: '16/06/1994', nuevo: '0', responsable: 'CORREDOR',
  };
  await soapRaw(
    'TEST 7: WSDL namespace + WSDL param order (token first) + responsable',
    buildWsdl('Estandar', orderedParams),
    'urn:emision#Estandar'
  );

  // Test 8: CC product 00312 with WSDL envelope + responsable
  await soapRaw(
    'TEST 8: WSDL namespace + CC product 00312 + responsable + suma_asegurada=15000',
    buildWsdl('Estandar', { ...orderedParams, cod_producto: '00312', suma_asegurada: '15000', responsable: 'CORREDOR' }),
    'urn:emision#Estandar'
  );
}

main().catch(e => console.error('Fatal:', e));
