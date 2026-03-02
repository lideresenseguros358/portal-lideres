/**
 * FEDPA EmisorPlan E2E Test Script
 * Tests: Upload docs → Emit DT → Emit CC → Retrieve carátula for both
 */

const BASE = 'http://localhost:3000';

async function step(label, fn) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(60)}`);
  try {
    const result = await fn();
    return result;
  } catch (err) {
    console.error(`❌ FAILED: ${err.message}`);
    return null;
  }
}

async function uploadDocs() {
  const fs = require('fs');
  const pdfBytes = fs.readFileSync('test_cedula.pdf');

  // Build multipart manually since we don't have undici
  const boundary = '----FormBoundary' + Date.now();
  
  function buildPart(fieldName, fileName, content, contentType) {
    return Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`),
      content,
      Buffer.from('\r\n'),
    ]);
  }
  
  function buildField(fieldName, value) {
    return Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"\r\n\r\n${value}\r\n`);
  }

  const body = Buffer.concat([
    buildField('environment', 'DEV'),
    buildPart('documento_identidad', 'documento_identidad.pdf', pdfBytes, 'application/pdf'),
    buildPart('licencia_conducir', 'licencia_conducir.pdf', pdfBytes, 'application/pdf'),
    buildPart('registro_vehicular', 'registro_vehicular.pdf', pdfBytes, 'application/pdf'),
    Buffer.from(`--${boundary}--\r\n`),
  ]);

  const res = await fetch(`${BASE}/api/fedpa/documentos/upload`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  return data;
}

async function emitPolicy(idDoc, planCode, planLabel, uso, sumaAsegurada, primaTotal) {
  const payload = {
    environment: 'DEV',
    Plan: planCode,
    idDoc,
    PrimerNombre: 'JUAN',
    PrimerApellido: 'PEREZ',
    SegundoNombre: 'CARLOS',
    SegundoApellido: 'GOMEZ',
    Identificacion: '8-888-8888',
    FechaNacimiento: '15/06/1990',
    Sexo: 'M',
    Email: 'test@lideresenseguros.com',
    Telefono: 2223344,
    Celular: 60001234,
    Direccion: 'CALLE 50 CIUDAD DE PANAMA',
    esPEP: 0,
    sumaAsegurada,
    Uso: uso,
    Marca: 'TOYOTA',
    Modelo: 'COROLLA',
    Ano: '2020',
    Motor: 'M123456',
    Placa: 'ABC1234',
    Vin: '1HGBH41JXMN109186',
    Color: 'BLANCO',
    Pasajero: 5,
    Puerta: 4,
    PrimaTotal: primaTotal,
  };

  console.log(`Plan: ${planCode} (${planLabel}), Uso: ${uso}, Suma: $${sumaAsegurada}, Prima: $${primaTotal}`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  const res = await fetch(`${BASE}/api/fedpa/emision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  return data;
}

async function getCaratula(nroPoliza) {
  console.log(`Requesting carátula for policy: ${nroPoliza}`);
  const res = await fetch(`${BASE}/api/fedpa/polizas/${nroPoliza}/caratula?environment=DEV`);
  
  const contentType = res.headers.get('content-type') || '';
  console.log('Status:', res.status);
  console.log('Content-Type:', contentType);

  if (contentType.includes('application/pdf')) {
    const buf = await res.arrayBuffer();
    const fs = require('fs');
    const filename = `caratula_${nroPoliza}.pdf`;
    fs.writeFileSync(filename, Buffer.from(buf));
    console.log(`✅ PDF saved: ${filename} (${buf.byteLength} bytes)`);
    return { success: true, filename, size: buf.byteLength };
  } else {
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
  }
}

// ═══ MAIN ═══
(async () => {
  console.log('🚀 FEDPA EmisorPlan E2E Test');
  console.log(`Base URL: ${BASE}`);
  console.log(`Time: ${new Date().toISOString()}`);

  // 1. Check token
  const tokenCheck = await step('1. CHECK TOKEN', async () => {
    const res = await fetch(`${BASE}/api/fedpa/auth/check?environment=DEV`);
    const data = await res.json();
    console.log('Token available:', data.hasToken);
    if (!data.hasToken) throw new Error('No token available');
    return data;
  });
  if (!tokenCheck) return;

  // 2. Upload documents
  const docsResult = await step('2. UPLOAD DOCUMENTS', uploadDocs);
  if (!docsResult?.success) {
    console.error('❌ Cannot continue without idDoc');
    return;
  }
  const idDoc = docsResult.idDoc;
  console.log(`\n📎 idDoc: ${idDoc}`);

  // 3. Try ALL plans from the API to find which ones are authorized
  console.log('\n[SCAN] Fetching all plans and testing emission for each...');
  const plansRes = await fetch(`${BASE}/api/fedpa/planes?environment=DEV`);
  const plansData = await plansRes.json();
  const allPlans = plansData?.data || [];
  
  // Deduplicate by plan number
  const uniquePlans = [];
  const seenPlanIds = new Set();
  for (const p of allPlans) {
    if (!seenPlanIds.has(p.plan)) {
      seenPlanIds.add(p.plan);
      uniquePlans.push(p);
    }
  }
  
  console.log(`Found ${uniquePlans.length} unique plans. Testing each for emission permission...\n`);
  
  const authorizedPlans = [];
  const unauthorizedPlans = [];
  
  for (const p of uniquePlans) {
    const uso = p.usos?.[0]?.uso || '10';
    const isDT = p.tipoplan?.includes('TERCEROS');
    const suma = isDT ? 0 : 25000;
    const prima = isDT ? 120 : 450;
    
    process.stdout.write(`  Plan ${p.plan} (${p.tipoplan} - ${p.nombreplan}, uso=${uso})... `);
    
    const res = await fetch(`${BASE}/api/fedpa/emision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        environment: 'DEV',
        Plan: p.plan,
        idDoc,
        PrimerNombre: 'JUAN', PrimerApellido: 'PEREZ',
        SegundoNombre: 'CARLOS', SegundoApellido: 'GOMEZ',
        Identificacion: '8-888-8888',
        FechaNacimiento: '15/06/1990',
        Sexo: 'M',
        Email: 'test@lideresenseguros.com',
        Telefono: 2223344, Celular: 60001234,
        Direccion: 'CALLE 50 CIUDAD DE PANAMA',
        esPEP: 0,
        sumaAsegurada: suma,
        Uso: uso,
        Marca: 'TOYOTA', Modelo: 'COROLLA', Ano: '2020',
        Motor: 'M123456', Placa: 'ABC1234',
        Vin: '1HGBH41JXMN109186', Color: 'BLANCO',
        Pasajero: 5, Puerta: 4,
        PrimaTotal: prima,
      }),
    });
    const data = await res.json();
    
    if (data.success) {
      console.log(`✅ AUTHORIZED! poliza=${data.poliza}`);
      authorizedPlans.push({ ...p, result: data });
    } else if (data.error?.includes('no tiene permiso')) {
      console.log(`❌ No permission`);
      unauthorizedPlans.push(p);
    } else {
      console.log(`⚠️ Other error: ${(data.error || '').substring(0, 80)}`);
      // Non-permission error means the plan IS authorized but something else failed
      authorizedPlans.push({ ...p, result: data, otherError: true });
    }
  }
  
  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  PLAN AUTHORIZATION SCAN RESULTS');
  console.log(`${'═'.repeat(60)}`);
  console.log(`Total plans scanned: ${uniquePlans.length}`);
  console.log(`Authorized (or other error): ${authorizedPlans.length}`);
  console.log(`Unauthorized: ${unauthorizedPlans.length}`);
  
  if (authorizedPlans.length > 0) {
    console.log('\n  AUTHORIZED PLANS:');
    for (const p of authorizedPlans) {
      const status = p.result?.success ? `✅ poliza=${p.result.poliza}` : `⚠️ ${(p.result?.error || '').substring(0, 60)}`;
      console.log(`    Plan ${p.plan} (${p.tipoplan} - ${p.nombreplan}) → ${status}`);
    }
  } else {
    console.log('\n  ❌ NO AUTHORIZED PLANS FOUND');
    console.log('  The FEDPA user SLIDERES (corredor 836) does not have emission');
    console.log('  permission for ANY plan. FEDPA needs to enable emisorplan');
    console.log('  permissions for this user before E2E testing can proceed.');
  }
  
  if (unauthorizedPlans.length > 0) {
    console.log(`\n  UNAUTHORIZED PLANS (${unauthorizedPlans.length}):`);
    for (const p of unauthorizedPlans) {
      console.log(`    Plan ${p.plan} (${p.tipoplan} - ${p.nombreplan})`);
    }
  }
})();;
