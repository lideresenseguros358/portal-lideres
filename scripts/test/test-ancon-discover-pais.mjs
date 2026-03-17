/**
 * Discover the País de Residencia catalog
 * 
 * From the ANCON cotizador screenshot:
 * - "País de Residencia / Domicilio" is a dropdown → has a catalog
 * - "Nacionalidad / País de Constitución" is a dropdown → separate catalog
 * - "País de Nacimiento" is a dropdown → separate catalog
 * 
 * Strategy:
 * 1. Try undiscovered SOAP methods: ListaPaisResidencia, ListaNacionalidad, 
 *    ListaPaisNacimiento, ListaPaisdomicilio, etc.
 * 2. Check if ListaPais returns different data with extra params
 * 3. Try the REST API at port 4443 for catalogs
 * 4. Inspect form_auto_fotos.php page source for AJAX calls
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const REST_URL = 'https://app.asegurancon.com:4443/SFIntegrationServiceApi.Api';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

async function soap(label, method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
  try {
    const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
    const text = await res.text();
    const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
    let parsed;
    if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
    else {
      // Check for SOAP Fault
      const fault = text.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/);
      if (fault) parsed = `FAULT: ${fault[1]}`;
      else parsed = text.substring(0, 400);
    }
    console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 400)}`);
    return parsed;
  } catch (e) {
    console.log(`[${label}] ERROR: ${e.message}`);
    return null;
  }
}

async function tryRest(label, path) {
  try {
    const res = await fetch(`${REST_URL}${path}`, { 
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const text = await res.text();
    console.log(`[REST ${label}] ${res.status} -> ${text.substring(0, 300)}`);
    return text;
  } catch (e) {
    console.log(`[REST ${label}] ERROR: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('=== DISCOVER PAIS DE RESIDENCIA CATALOG ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // ===== 1. Try undiscovered SOAP methods =====
  console.log('\n--- Trying undiscovered SOAP methods ---');
  
  const methodsToTry = [
    'ListaPaisResidencia',
    'ListaPaisDomicilio', 
    'ListaNacionalidad',
    'ListaPaisNacimiento',
    'ListaPaisresidencia',
    'Listapaisresidencia',
    'ListaPais_Residencia',
    'ListaPaisdomicilio',
    'ListaResidencia',
    'ListaDomicilio',
    'ListaPaisConstitucion',
    'ListaConstitucion',
  ];

  for (const method of methodsToTry) {
    await soap(method, method, [['token', token]]);
  }

  // ===== 2. ListaPais with different params =====
  console.log('\n--- ListaPais with extra params ---');
  // Maybe ListaPais with tipo_persona returns codes?
  await soap('ListaPais(N)', 'ListaPais', [['token', token], ['tipo_persona', 'N']]);
  await soap('ListaPais(tipo=R)', 'ListaPais', [['token', token], ['tipo', 'R']]);
  await soap('ListaPais(tipo=D)', 'ListaPais', [['token', token], ['tipo', 'D']]);

  // ===== 3. Check full ListaPais response for hidden codes =====
  console.log('\n--- Full ListaPais dump (first 20) ---');
  const paises = await soap('ListaPais-full', 'ListaPais', [['token', token]]);
  if (Array.isArray(paises)) {
    console.log(`  Total countries: ${paises.length}`);
    console.log(`  Keys: ${JSON.stringify(Object.keys(paises[0]))}`);
    // Show first 20 with ALL fields
    for (let i = 0; i < Math.min(20, paises.length); i++) {
      console.log(`  [${i}] ${JSON.stringify(paises[i])}`);
    }
    // Find Panama
    const pIdx = paises.findIndex(p => (p.nombre || '').toUpperCase().includes('PANAM'));
    if (pIdx >= 0) {
      console.log(`  PANAMA at index ${pIdx}: ${JSON.stringify(paises[pIdx])}`);
      // Check if index could be the code
      console.log(`  Possible code by position: ${pIdx + 1} or ${String(pIdx + 1).padStart(3, '0')}`);
    }
  }

  // ===== 4. Try fetching cotizador PHP pages for JS source =====
  console.log('\n--- Fetching cotizador form JS ---');
  const jsUrls = [
    '/cotizador_externo/cotizador_autov01/js/main.js',
    '/cotizador_externo/cotizador_autov01/js/form.js', 
    '/cotizador_externo/cotizador_autov01/js/cliente.js',
    '/cotizador_externo/cotizador_autov01/js/datos.js',
    '/cotizador_externo/cotizador_autov01/js/app.js',
    '/cotizador_externo/cotizador_autov01/assets/js/main.js',
    '/cotizador_externo/cotizador_autov01/scripts/datos_cliente.js',
  ];
  
  for (const jsUrl of jsUrls) {
    try {
      const res = await fetch(`https://app.asegurancon.com${jsUrl}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  [${jsUrl}] OK (${text.length} bytes): ${text.substring(0, 200)}`);
        // Look for pais_residencia or SOAP calls
        if (text.includes('pais') || text.includes('residencia') || text.includes('SOAP') || text.includes('GuardarCliente')) {
          console.log(`    >>> Contains relevant keywords!`);
          // Extract relevant lines
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.includes('pais') || line.includes('residencia') || line.includes('GuardarCliente')) {
              console.log(`    ${line.trim().substring(0, 200)}`);
            }
          }
        }
      } else {
        console.log(`  [${jsUrl}] ${res.status}`);
      }
    } catch (e) {
      console.log(`  [${jsUrl}] ERROR: ${e.message}`);
    }
  }

  // ===== 5. Try the datos_cliente PHP page directly =====
  console.log('\n--- Fetching datos_cliente page ---');
  const clientPages = [
    '/cotizador_externo/cotizador_autov01/datos_cliente.php',
    '/cotizador_externo/cotizador_autov01/form_datos_cliente.php',
    '/cotizador_externo/cotizador_autov01/form_cliente.php',
    '/cotizador_externo/cotizador_autov01/generales_cliente.php',
    '/cotizador_externo/cotizador_autov01/ajax/datos_cliente.php',
    '/cotizador_externo/cotizador_autov01/ajax/pais_residencia.php',
    '/cotizador_externo/cotizador_autov01/ajax/catalogos.php',
    '/cotizador_externo/cotizador_autov01/api/catalogos.php',
  ];

  for (const page of clientPages) {
    try {
      const res = await fetch(`https://app.asegurancon.com${page}`);
      const text = await res.text();
      if (res.ok && text.length > 100) {
        console.log(`  [${page}] OK (${text.length} bytes)`);
        // Look for pais/residencia references
        if (text.includes('pais') || text.includes('residencia') || text.includes('select') || text.includes('option')) {
          console.log(`    >>> Contains relevant content`);
          console.log(`    ${text.substring(0, 500)}`);
        }
      } else {
        console.log(`  [${page}] ${res.status} (${text.length} bytes)`);
      }
    } catch (e) {
      console.log(`  [${page}] ERROR: ${e.message}`);
    }
  }

  // ===== 6. GuardarCliente with prov_residencia as POSITION INDEX =====
  // If ListaPais has PANAMÁ at a specific index, maybe that index IS the code
  console.log('\n--- GuardarCliente with prov_residencia as ListaPais index ---');
  
  // Get cotización first
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

  // If ListaPais has PANAMÁ at some index, try that index as prov_residencia
  if (Array.isArray(paises)) {
    const panamaIdx = paises.findIndex(p => (p.nombre || '').toUpperCase() === 'PANAMÁ');
    if (panamaIdx >= 0) {
      const codes = [
        String(panamaIdx + 1), // 1-indexed
        String(panamaIdx + 1).padStart(3, '0'), // zero-padded
        String(panamaIdx), // 0-indexed  
      ];
      
      for (const code of codes) {
        console.log(`\n  prov_residencia=${code} (Panama at index ${panamaIdx})`);
        await soap(`GC-idx-${code}`, 'GuardarCliente', [
          ['tipo_persona', 'N'], ['cod_producto', '41'], ['pasaporte', ''],
          ['primer_nombre', 'JUAN'], ['segundo_nombre', ''], ['primer_apellido', 'PEREZ'],
          ['segundo_apellido', ''], ['casada', ''], ['fecha_nac', '16/06/1994'], ['sexo', 'M'],
          ['presidencia', code], ['nacionalidad', code],
          ['direccion_laboral', 'PANAMA'], ['calle', 'CALLE 50'], ['casa', '1'],
          ['barriada', 'EL CANGREJO'], ['corregimiento', 'BELLA VISTA'],
          ['direccion_cobros', 'PANAMA'], ['telefono1', '2221133'], ['telefono2', ''],
          ['celular', '60000001'], ['celular2', ''], ['email', 'test@test.com'], ['apartado', ''],
          ['ced_prov', '8'], ['ced_inicial', '888'], ['tomo', '9999'],
          ['folio', ''], ['asiento', ''], ['ocupacion', '001'], ['pais_nacimiento', code],
          ['ofondo', '001'], ['monto_ingreso', '001'], ['prov_residencia', code],
          ['cli_forpago', '002'], ['cli_frepago', '002'],
          ['cli_lista', '002|campo_lista_neg'], ['cli_fundacion', '002|campo_fundongzon'],
          ['cli_pep1', '002|campo_pep'],
          ['asegurado_igual', '001'], ['asegurado_benef', '005'], ['asegurado_tercero', '006'],
          ['cli_coa', '0'], ['dv', ''], ['rlegal', ''], ['ncomercial', ''], ['aoperacion', ''],
          ['cod_actividad', '001'], ['cod_clianiocon', '001'], ['razon_social', ''],
          ['token', token], ['no_cotizacion', noCot], ['figura', '1'],
        ]);
      }
    }
  }
}

main().catch(e => console.error('Fatal:', e));
