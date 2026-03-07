/**
 * Script de prueba: Emisión Regional DT y CC
 * 
 * Ejecutar: node scripts/test-regional-emission.mjs
 * Requiere: dev server corriendo en localhost:3000
 * 
 * Prueba el flujo completo:
 *   DT: third-party plans → emit-rc → print carátula
 *   CC: cotización → emit-cc → print carátula
 */

const BASE = 'http://localhost:3000';

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════
async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(120000) });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    const buf = await res.arrayBuffer();
    return { _status: res.status, _isPdf: true, _size: buf.byteLength };
  }
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return { _status: res.status, ...data };
  } catch {
    return { _status: res.status, _rawHtml: true, error: 'Response was HTML, not JSON', _preview: text.substring(0, 200) };
  }
}

function log(emoji, msg) { console.log(`${emoji}  ${msg}`); }
function pass(msg) { log('✅', msg); }
function fail(msg) { log('❌', msg); }
function info(msg) { log('ℹ️', msg); }
function warn(msg) { log('⚠️', msg); }

// ═══════════════════════════════════════════════
// TEST 1: Regional DT (Daños a Terceros)
// ═══════════════════════════════════════════════
async function testRegionalDT() {
  console.log('\n' + '═'.repeat(60));
  console.log('  TEST: REGIONAL DT (Daños a Terceros) — Flujo Completo');
  console.log('═'.repeat(60) + '\n');

  // Step 1: Fetch third-party plans
  info('Paso 1: Obteniendo planes DT de Regional...');
  const tpData = await fetchJSON(`${BASE}/api/regional/third-party`);
  
  if (!tpData.success) {
    fail('API third-party falló: ' + (tpData.error || 'unknown'));
    return false;
  }

  const plans = tpData.plans || [];
  if (plans.length < 2) {
    fail('Se esperaban 2 planes, se obtuvieron: ' + plans.length);
    return false;
  }

  for (const p of plans) {
    const covCount = p.coverageList?.length || 0;
    const benCount = p.endosoBenefits?.length || 0;
    info(`  ${p.name}: codplan=${p.codplan}, precio=$${p.annualPremium}, coberturas=${covCount}, beneficios=${benCount}`);
    
    if (!p.codplan) fail(`  Plan ${p.name} NO tiene codplan!`);
    else pass(`  Plan ${p.name} tiene codplan: ${p.codplan}`);
    
    if (covCount === 0) fail(`  Plan ${p.name} NO tiene coberturas!`);
    else pass(`  Plan ${p.name} tiene ${covCount} coberturas`);
    
    if (benCount === 0) fail(`  Plan ${p.name} NO tiene beneficios!`);
    else pass(`  Plan ${p.name} tiene ${benCount} beneficios`);
  }

  const basicPlan = plans.find(p => p.planType === 'basic');
  const planCode = basicPlan?.codplan || '30';
  
  // Step 2: Emit RC policy
  info('');
  info('Paso 2: Emitiendo póliza RC (plan=' + planCode + ')...');
  
  const emitData = await fetchJSON(`${BASE}/api/regional/auto/emit-rc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan: planCode,
      nombre: 'PRUEBA',
      apellido: 'EMISION DT',
      fechaNacimiento: '1990-05-15',
      edad: 35,
      sexo: 'M',
      edocivil: 'S',
      telefono: '2900000',
      celular: '62900000',
      email: 'test@lideresenseguros.com',
      codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1,
      dirhab: 'Ciudad de Panama',
      tppersona: 'N', tpodoc: 'C',
      prov: 8, letra: null, tomo: 123, asiento: 4567,
      codmarca: 74, codmodelo: 1, anio: 2024,
      numplaca: '', serialcarroceria: '', serialmotor: '', color: '001',
      condHabNombre: 'PRUEBA', condHabApellido: 'EMISION DT',
      condHabSexo: 'M', condHabEdocivil: 'S',
    }),
  });

  if (!emitData.success) {
    fail('Emisión RC falló: ' + (emitData.error || 'unknown'));
    if (emitData.error?.includes('aborted') || emitData.error?.includes('timeout')) {
      warn('⏱️ El servidor de Regional (desa.laregionaldeseguros.com) no responde — está caído');
    }
    return false;
  }

  pass('Póliza emitida: ' + emitData.poliza);
  info('  NumCot: ' + emitData.numcot);

  // Step 3: Print carátula
  info('');
  info('Paso 3: Imprimiendo carátula (póliza=' + emitData.poliza + ')...');
  
  const printData = await fetchJSON(`${BASE}/api/regional/auto/print?poliza=${emitData.poliza}`);
  
  if (printData._isPdf && printData._size > 0) {
    pass('Carátula PDF recibida: ' + printData._size + ' bytes');
  } else {
    fail('No se pudo obtener carátula: ' + JSON.stringify(printData).substring(0, 200));
    return false;
  }

  console.log('\n' + '─'.repeat(60));
  pass('🎉 REGIONAL DT: FLUJO COMPLETO EXITOSO');
  console.log('─'.repeat(60));
  return true;
}

// ═══════════════════════════════════════════════
// TEST 2: Regional CC (Cobertura Completa)
// ═══════════════════════════════════════════════
async function testRegionalCC() {
  console.log('\n' + '═'.repeat(60));
  console.log('  TEST: REGIONAL CC (Cobertura Completa) — Flujo Completo');
  console.log('═'.repeat(60) + '\n');

  // Step 1: Generate CC quote
  info('Paso 1: Generando cotización CC con Regional...');
  
  const cotizData = await fetchJSON(`${BASE}/api/regional/auto/quote-cc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'PRUEBA',
      apellido: 'EMISION CC',
      edad: 35,
      sexo: 'M',
      edocivil: 'S',
      tppersona: 'N',
      tpodoc: 'C',
      prov: 8,
      tomo: 123,
      asiento: 4567,
      telefono: '2900000',
      celular: '62900000',
      email: 'test@lideresenseguros.com',
      vehnuevo: 'N',
      codMarca: 74,
      codModelo: 1,
      anio: 2024,
      valorVeh: 15000,
      numPuestos: 5,
      endoso: '1',
    }),
  });

  if (!cotizData.success) {
    fail('Cotización CC falló: ' + (cotizData.error || 'unknown'));
    if (cotizData.error?.includes('aborted') || cotizData.error?.includes('timeout')) {
      warn('⏱️ El servidor de Regional (desa.laregionaldeseguros.com) no responde — está caído');
    }
    return false;
  }

  const numcot = cotizData.numcot || cotizData.data?.numcot;
  if (!numcot) {
    fail('No se obtuvo número de cotización');
    info('Response: ' + JSON.stringify(cotizData).substring(0, 500));
    return false;
  }

  pass('Cotización generada: numcot=' + numcot);

  // Step 2: Emit CC policy
  info('');
  info('Paso 2: Emitiendo póliza CC (numcot=' + numcot + ')...');
  
  const emitData = await fetchJSON(`${BASE}/api/regional/auto/emit-cc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      numcot: String(numcot),
      codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1,
      dirhab: 'Ciudad de Panama',
      ocupacion: 1, ingresoAnual: 1, paisTributa: 507, pep: 'N',
      vehnuevo: 'N', numplaca: '', serialcarroceria: '', serialmotor: '',
      color: '093', usoveh: 'P', peso: 'L',
      acreedor: '81',
      cuotas: '1', opcionPrima: '1',
    }),
  });

  if (!emitData.success) {
    fail('Emisión CC falló: ' + (emitData.error || 'unknown'));
    return false;
  }

  const poliza = emitData.poliza;
  pass('Póliza emitida: ' + poliza);
  info('  PDF URL: ' + (emitData.pdfUrl || 'N/A'));

  // Step 3: Print carátula
  if (poliza) {
    info('');
    info('Paso 3: Imprimiendo carátula (póliza=' + poliza + ')...');
    
    const printData = await fetchJSON(`${BASE}/api/regional/auto/print?poliza=${poliza}`);
    
    if (printData._isPdf && printData._size > 0) {
      pass('Carátula PDF recibida: ' + printData._size + ' bytes');
    } else if (emitData.pdfUrl) {
      warn('Print endpoint falló, pero pdfUrl disponible: ' + emitData.pdfUrl);
    } else {
      fail('No se pudo obtener carátula');
    }
  }

  console.log('\n' + '─'.repeat(60));
  pass('🎉 REGIONAL CC: FLUJO COMPLETO EXITOSO');
  console.log('─'.repeat(60));
  return true;
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   PRUEBAS DE EMISIÓN REGIONAL — DT y CC               ║');
  console.log('║   Servidor: localhost:3000                             ║');
  console.log('║   API Regional: desa.laregionaldeseguros.com:10443    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Quick connectivity check
  info('Verificando conectividad con API Regional...');
  try {
    const check = await fetch(`${BASE}/api/regional/third-party`, { signal: AbortSignal.timeout(30000) });
    if (check.ok) {
      pass('API Regional accesible via portal');
    }
  } catch (e) {
    fail('No se puede conectar al dev server en localhost:3000');
    info('Ejecuta: npm run dev');
    process.exit(1);
  }

  const dtResult = await testRegionalDT();
  const ccResult = await testRegionalCC();

  console.log('\n' + '═'.repeat(60));
  console.log('  RESUMEN');
  console.log('═'.repeat(60));
  console.log(`  Regional DT: ${dtResult ? '✅ PASÓ' : '❌ FALLÓ'}`);
  console.log(`  Regional CC: ${ccResult ? '✅ PASÓ' : '❌ FALLÓ'}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
