/**
 * Call buscar_nacionalidad.php to find the gentilicio for PANAMÁ (code 157)
 * 
 * The cotizador does:
 *   $.post("buscar_nacionalidad.php", {cod_pais: 157}, function(data) {
 *     var datos = data.split('|');
 *     var nacionalidad = datos[0];
 *     var gentilicio = datos[1];
 *     $("#presidencia").val(gentilicio);
 *   });
 * 
 * So when user selects PANAMÁ (157) from dropdown:
 * - #presidencia hidden field = gentilicio
 * - #paises select value = 157
 * 
 * Then guardar_cliente.php receives:
 * - presidencia = gentilicio value
 * - nacionalidad = whatever #nacionalidad dropdown value is (name string)
 * 
 * So "presidencia" in the SOAP GuardarCliente method might need the GENTILICIO, not the country name!
 */

const BASE_URL = 'https://app.asegurancon.com/cotizador_externo/cotizador_autov01';
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
  else parsed = text.substring(0, 500);
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 500)}`);
  return parsed;
}

async function main() {
  console.log('=== GENTILICIO + FULL FORM SIMULATION ===\n');

  // ===== 1. Call buscar_nacionalidad.php =====
  console.log('--- buscar_nacionalidad.php ---');
  const paises = [157, 75, 54, 136, 60, 15]; // PANAMA, USA, COLOMBIA, MEXICO, COSTA RICA, ARGENTINA
  for (const cod of paises) {
    try {
      const res = await fetch(`${BASE_URL}/buscar_nacionalidad.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `cod_pais=${cod}`,
      });
      const text = await res.text();
      console.log(`  cod_pais=${cod}: "${text}"`);
    } catch (e) {
      console.log(`  cod_pais=${cod}: ERROR ${e.message}`);
    }
  }

  // ===== 2. Login and get token =====
  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // ===== 3. Get cotización =====
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
  console.log(`\nNoCot: ${noCot}\n`);
  if (!noCot) return;

  // ===== 4. Try GC with gentilicio values for presidencia =====
  // Wait for buscar_nacionalidad results to know the exact value
  // For now try common gentilicios
  const gentilicios = [
    ['PANAMEÑA', 'PANAMENA'],
    ['PANAMEÑO', 'PANAMENO'],
    ['PANAMEÑA', 'PANAMEÑA'],  // with tilde
  ];

  for (const [pres, label] of gentilicios) {
    console.log(`\n--- GC with presidencia="${pres}" ---`);
    await soap(`GC-${label}`, 'GuardarCliente', [
      ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
      ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
      ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
      ['presidencia', pres], ['nacionalidad', 'PANAMA'],
      ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
      ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
      ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
      ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
      ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
      ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', 'PANAMA'],
      ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', '157'],
      ['cli_forpago', '002'], ['cli_frepago', '002'],
      ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
      ['cli_pep1', '002|campo_pep'],
      ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
      ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
      ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
      ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
    ]);
  }

  // ===== 5. Try calling guardar_cliente.php directly (PHP POST, not SOAP) =====
  console.log('\n\n--- guardar_cliente.php (PHP POST, bypassing SOAP/WSDL) ---');
  const formData = new URLSearchParams({
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
    presidencia: 'PANAMENA',  // gentilicio
    nacionalidad: 'PANAMA',
    direccion_laboral: 'PANAMA',
    pep: '002|campo_pep',
    profesion: '1',
    ocupacion: '001',
  });

  try {
    const res = await fetch(`${BASE_URL}/guardar_cliente.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    const text = await res.text();
    console.log(`  Status: ${res.status}`);
    console.log(`  Response: ${text.substring(0, 500)}`);
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }
}

main().catch(e => console.error('Fatal:', e));
