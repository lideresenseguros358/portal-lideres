/**
 * FINAL attempt: Test GuardarCliente with exact values from ANCON's own cotizador form.
 * 
 * From the cotizador:
 * - #paises dropdown: value="157" for PANAMÁ
 * - presidencia (hidden): auto-filled with "PANAMÁ" from buscar_nacionalidad.php
 * - nacionalidad: "PANAMÁ" (name string from dropdown)
 * - The guardar_cliente.php PHP POST sends: presidencia="PANAMÁ", nacionalidad="PANAMÁ"
 * 
 * BUT: The cotizador uses PHP POST (guardar_cliente.php), NOT SOAP GuardarCliente.
 * The PHP endpoint is NOT constrained by WSDL.
 * 
 * Last attempts:
 * 1. presidencia="PANAMÁ" (exact from buscar_nacionalidad) — may cause SQL accent issue
 * 2. Try the PHP guardar_cliente.php with session cookie
 * 3. Try WSDL-correct RPC/encoded envelope with prov_residencia as "157|PANAMÁ" pipe format
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const BASE_URL = 'https://app.asegurancon.com/cotizador_externo/cotizador_autov01';
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
  else parsed = text.substring(0, 500);
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 500)}`);
  return parsed;
}

function gcParams(token, noCot, overrides = {}) {
  return [
    ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
    ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
    ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
    ['presidencia', overrides.presidencia ?? 'PANAMA'],
    ['nacionalidad', overrides.nacionalidad ?? 'PANAMA'],
    ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
    ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
    ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
    ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
    ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
    ['folio', ''], ['asiento', ''], ['ocupacion', '001'],
    ['pais_nacimiento', overrides.pais_nacimiento ?? 'PANAMA'],
    ['ofondo', '001'], ['monto_ingreso', '001'],
    ['prov_residencia', overrides.prov_residencia ?? '008'],
    ['cli_forpago', '002'], ['cli_frepago', '002'],
    ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
    ['cli_pep1', '002|campo_pep'],
    ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
    ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
    ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
    ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
  ];
}

async function main() {
  console.log('=== FINAL PAIS RESIDENCIA ATTEMPTS ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  const cr = await soap('COT', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '0'], ['cod_producto', '07159'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]);
  let noCot = null;
  if (cr?.cotizacion) {
    for (const items of Object.values(cr.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCot = it.Descripcion1; break; } }
      }
      if (noCot) break;
    }
  }
  console.log(`NoCot: ${noCot}\n`);
  if (!noCot) return;

  // Test 1: prov_residencia = "157|PANAMA" (pipe format like other catalog fields)
  console.log('--- T1: prov_residencia="157|PANAMA" ---');
  await soap('T1', 'GuardarCliente', gcParams(token, noCot, { prov_residencia: '157|PANAMA' }));

  // Test 2: prov_residencia = "157|campo_pais_res" (pipe format matching pattern)
  console.log('--- T2: prov_residencia="157|campo_pais_res" ---');
  await soap('T2', 'GuardarCliente', gcParams(token, noCot, { prov_residencia: '157|campo_pais_res' }));

  // Test 3: prov_residencia = "008|157" (province + country code)
  console.log('--- T3: prov_residencia="008|157" ---');
  await soap('T3', 'GuardarCliente', gcParams(token, noCot, { prov_residencia: '008|157' }));

  // Test 4: Try login to PHP cotizador and use session to call guardar_cliente.php
  console.log('\n--- T4: PHP login attempt ---');
  try {
    // Try to login to the cotizador
    const loginRes = await fetch(`${BASE_URL}/../index.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `usuario=${USUARIO}&password=${PASSWORD}`,
      redirect: 'manual',
    });
    console.log(`  Login status: ${loginRes.status}`);
    const cookies = loginRes.headers.getSetCookie?.() || [];
    console.log(`  Cookies: ${cookies.join('; ')}`);
    const sessionCookie = cookies.find(c => c.includes('PHPSESSID')) || '';
    
    if (sessionCookie) {
      const cookieVal = sessionCookie.split(';')[0];
      console.log(`  Session: ${cookieVal}`);
      
      // Try guardar_cliente.php with session
      const gcRes = await fetch(`${BASE_URL}/guardar_cliente.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieVal,
        },
        body: new URLSearchParams({
          tipo_busqueda: 'cedula',
          no_cotizacion: noCot,
          operacion: 'UPDATE',
          cedula: '8-888-9999',
          primer_nombre: 'JUAN',
          segundo_nombre: '',
          primer_apellido: 'PEREZ',
          segundo_apellido: '',
          casada: '',
          fecha_nac: '16/06/1994',
          corregimiento: 'BELLA VISTA',
          barriada: 'EL CANGREJO',
          calle: 'CALLE 50',
          casa: '1',
          direccion_cobros: 'PANAMA',
          telefono1: '2221133',
          telefono2: '',
          celular: '60000001',
          fax: '',
          email: 'test@test.com',
          apartado: '',
          ced_prov: '8',
          tomo: '888',
          asiento: '9999',
          sexo: 'M',
          pasaporte: '',
          checked_pagador: '1',
          presidencia: 'PANAMA',
          nacionalidad: 'PANAMA',
          direccion_laboral: 'PANAMA',
          pep: '002|campo_pep',
          profesion: '1',
          ocupacion: '001',
        }).toString(),
      });
      const gcText = await gcRes.text();
      console.log(`  guardar_cliente.php: ${gcRes.status}`);
      console.log(`  Response: ${gcText.substring(0, 500)}`);
      
      // Check if client was registered
      await soap('CC-after-php', 'ConsultarCliente', [
        ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
      ]);
    }
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }

  // Test 5: Try calling the login endpoint used by the cotizador
  console.log('\n--- T5: Login via cotizador login ---');
  try {
    // The cotizador login might be at a different URL
    const loginUrls = [
      `${BASE_URL}/../validar.php`,
      `${BASE_URL}/../login.php`,
      `${BASE_URL}/validar.php`,
      `${BASE_URL}/../validar_login.php`,
    ];
    
    for (const url of loginUrls) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `usuario=${USUARIO}&clave=${PASSWORD}&aid=${USUARIO}`,
        redirect: 'manual',
      });
      console.log(`  ${url}: ${res.status}`);
      const setCookies = res.headers.getSetCookie?.() || [];
      if (setCookies.length > 0) {
        console.log(`  Cookies: ${setCookies.join('; ').substring(0, 200)}`);
      }
      if (res.status === 302 || res.status === 301) {
        console.log(`  Redirect: ${res.headers.get('location')}`);
      }
    }
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }
}

main().catch(e => console.error('Fatal:', e));
