/**
 * EXHAUSTIVE GuardarCliente test — try EVERY possible value for pais_residencia
 * 
 * Strategy:
 * 1. First, discover ALL available catalog methods (ListaNacionalidad? ListaResidencia?)
 * 2. Try different values in the EXISTING WSDL fields that might map to pais_residencia:
 *    - presidencia (currently sending 'PANAMA')
 *    - nacionalidad (currently sending 'PANAMA')
 *    - pais_nacimiento (currently sending 'PANAMA')
 *    - prov_residencia (currently sending '008')
 * 3. Try nationality-style values: PANAMEÑO, PANAMEÑA, PAN, PA, 170, etc.
 * 4. Try ListaPais exact match: PANAMÁ (with proper encoding)
 * 
 * KEY INSIGHT from user: Their production cotizador works fine. So the API IS functional.
 * The error is on OUR side — likely wrong values or missing understanding of field mapping.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function bld(method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

async function soap(label, method, pairs) {
  const body = bld(method, pairs);
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 400)}`);
  return parsed;
}

function gcParams(overrides = {}) {
  const base = {
    tipo_persona: 'N', cod_producto: '41', pasaporte: '',
    primer_nombre: 'JUAN', segundo_nombre: '', primer_apellido: 'PEREZ',
    segundo_apellido: '', casada: '', fecha_nac: '16/06/1994', sexo: 'M',
    presidencia: 'PANAMA', nacionalidad: 'PANAMA',
    direccion_laboral: 'PANAMA CITY', calle: 'CALLE 50', casa: '1',
    barriada: 'EL CANGREJO', corregimiento: 'BELLA VISTA',
    direccion_cobros: 'PANAMA CITY', telefono1: '2221133', telefono2: '',
    celular: '60000001', celular2: '', email: 'test@test.com', apartado: '',
    ced_prov: '8', ced_inicial: '888', tomo: '9999',
    folio: '', asiento: '', ocupacion: '001', pais_nacimiento: 'PANAMA',
    ofondo: '001', monto_ingreso: '001', prov_residencia: '008',
    cli_forpago: '002', cli_frepago: '002', cli_lista: '002',
    cli_fundacion: '002', cli_pep1: '002', asegurado_igual: '001',
    asegurado_benef: '004', asegurado_tercero: '006', cli_coa: '0',
    dv: '', rlegal: '', ncomercial: '', aoperacion: '',
    cod_actividad: '', cod_clianiocon: '', razon_social: '',
  };
  // Apply overrides
  Object.assign(base, overrides);
  return base;
}

async function main() {
  console.log('=== EXHAUSTIVE GuardarCliente pais_residencia search ===\n');

  // Login
  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // Step 1: Try to discover unknown catalog methods
  console.log('\n--- Step 1: Discover catalog methods ---');
  const catalogMethods = [
    'ListaNacionalidad', 'ListaResidencia', 'ListaPaisResidencia',
    'ListaPresidencia', 'ListaSexo', 'ListaFigura',
    'ListaMontoIngreso', 'ListaOrigenFondo', 'ListaFormaPago',
    'ListaFrecuenciaPago', 'ListaListaNegra', 'ListaFundacion',
  ];
  for (const m of catalogMethods) {
    await soap(m, m, [['token', token]]);
  }

  // Step 2: Get a fresh cotización
  console.log('\n--- Step 2: Fresh cotización ---');
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
  console.log(`NoCot: ${noCot}`);
  if (!noCot) return;

  // Step 3: Try different values in EXISTING fields
  // The error says "PAÍS DE RESIDENCIA" — maybe it maps to one of the existing fields
  // and our value is just wrong
  
  const tests = [
    // Test: Maybe "presidencia" IS "pais_residencia" and needs a specific format
    { label: 'presidencia=PANAMENO', overrides: { presidencia: 'PANAMENO' } },
    { label: 'presidencia=008', overrides: { presidencia: '008' } },
    { label: 'presidencia=PAN', overrides: { presidencia: 'PAN' } },
    { label: 'presidencia=PA', overrides: { presidencia: 'PA' } },
    { label: 'presidencia=170', overrides: { presidencia: '170' } },
    
    // Test: Maybe prov_residencia needs the NAME not the CODE
    { label: 'prov_residencia=PANAMA', overrides: { prov_residencia: 'PANAMA' } },
    
    // Test: Maybe nacionalidad maps to pais_residencia
    { label: 'nacionalidad=PANAMENO', overrides: { nacionalidad: 'PANAMENO' } },
    { label: 'nacionalidad=008', overrides: { nacionalidad: '008' } },
    { label: 'nacionalidad=170', overrides: { nacionalidad: '170' } },
    
    // Test: Maybe pais_nacimiento is what triggers pais_residencia
    { label: 'pais_nacimiento=008', overrides: { pais_nacimiento: '008' } },
    
    // Test: ALL three country-related fields with code 008
    { label: 'ALL=008', overrides: { presidencia: '008', nacionalidad: '008', pais_nacimiento: '008', prov_residencia: '008' } },
    
    // Test: ALL three country-related fields with PANAMENO
    { label: 'ALL=PANAMENO', overrides: { presidencia: 'PANAMENO', nacionalidad: 'PANAMENO', pais_nacimiento: 'PANAMENO' } },
    
    // Test: prov_residencia as FULL text with province name
    { label: 'prov=008|PANAMA', overrides: { prov_residencia: '008|PANAMA' } },
  ];

  console.log(`\n--- Step 3: Testing ${tests.length} variations ---`);
  
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    // Need fresh cotización for each test since token is consumed
    // Actually no — GuardarCliente might not consume token. Let's try sequentially first
    const params = gcParams(t.overrides);
    const pairs = Object.entries(params).map(([k,v]) => [k,v]);
    pairs.push(['token', token], ['no_cotizacion', noCot], ['figura', '1']);
    
    const r = await soap(`GC-${i+1} (${t.label})`, 'GuardarCliente', pairs);
    
    // Check if we got a different error
    const msg = Array.isArray(r) ? r[0]?.Mensaje : typeof r === 'string' ? r : JSON.stringify(r);
    if (msg && !msg.includes('RESIDENCIA') && !msg.includes('Token Inactivo')) {
      console.log(`  >>> NEW ERROR: ${msg}`);
    }
    if (msg && msg.includes('Token Inactivo')) {
      console.log('  Token expired, getting fresh token...');
      const lr2 = await soap('RELOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
      const newToken = lr2?.Login?.[0]?.Token;
      if (!newToken) { console.log('  Could not refresh token'); return; }
      // Replace token for remaining tests
      // But we need a new cotización too
      const cr2 = await soap('COT2', 'Estandar', [
        ['token', newToken], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
        ['suma_asegurada', '0'], ['cod_producto', '07159'], ['cedula', '8-888-9999'],
        ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
        ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
        ['nuevo', '0'], ['responsable', 'CORREDOR'],
      ]);
      let newCot = null;
      if (cr2?.cotizacion) {
        for (const items of Object.values(cr2.cotizacion)) {
          if (Array.isArray(items)) {
            for (const it of items) { if (it.Cobertura === 'NoCotizacion') { newCot = it.Descripcion1; break; } }
          }
          if (newCot) break;
        }
      }
      // Can't continue without new cot, but this shouldn't happen if we use WSDL-only params
      console.log(`  New token + cotización: ${newCot}`);
      break; // Token expired means we sent something wrong
    }
  }
}

main().catch(e => console.error('Fatal:', e));
