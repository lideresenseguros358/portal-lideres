/**
 * FEDPA DT (Daños a Terceros) Emission + Carátula Download Test
 * 
 * Flow mirrors the real user journey:
 *   0. GET /api/fedpa/third-party → real cotización (idCotizacion + exact premium)
 *   1. POST /api/fedpa/documentos/upload → idDoc
 *   2. POST /api/fedpa/emision → nroPoliza  (uses emissionPlanCode 1000 or 1002)
 *   3. POST /api/fedpa/caratula → PDF binary
 * 
 * Usage: node test-fedpa-dt-emission.js
 */

const BASE = 'http://localhost:3000';
const fs = require('fs');
const path = require('path');

// ── Test persons (emission data filled in after cotización) ──
const testPersons = [
  {
    label: 'basic',
    name: 'DT Test #1 — Plan Básico (1000)',
    person: {
      PrimerNombre: 'Carlos',
      PrimerApellido: 'Martinez',
      SegundoNombre: 'Alberto',
      SegundoApellido: 'Rodriguez',
      Identificacion: '8-888-1001',
      FechaNacimiento: '15/06/1985',
      Sexo: 'M',
      Email: 'carlos.test@example.com',
      Telefono: 67001001,
      Celular: 67001001,
      Direccion: 'Calle 50, Panama City',
      esPEP: 0,
      Ocupacion: 99,
      Acreedor: '',
      sumaAsegurada: 0,
      Uso: '10',
      Marca: 'TOY',
      Modelo: 'COROLLA',
      MarcaNombre: 'Toyota',
      ModeloNombre: 'Corolla',
      Ano: '2022',
      Motor: 'MOT-DT-001',
      Placa: 'DT-TEST-01',
      Vin: 'JTDKN3DU5A0DT0001',
      Color: 'BLANCO',
      Pasajero: 5,
      Puerta: 4,
    },
  },
  {
    label: 'premium',
    name: 'DT Test #2 — Plan VIP (1002)',
    person: {
      PrimerNombre: 'Maria',
      PrimerApellido: 'Lopez',
      SegundoNombre: 'Elena',
      SegundoApellido: 'Gonzalez',
      Identificacion: '8-888-1002',
      FechaNacimiento: '22/03/1990',
      Sexo: 'F',
      Email: 'maria.test@example.com',
      Telefono: 67001002,
      Celular: 67001002,
      Direccion: 'Via España 123, Panama',
      esPEP: 0,
      Ocupacion: 99,
      Acreedor: '',
      sumaAsegurada: 0,
      Uso: '10',
      Marca: 'HYU',
      Modelo: 'TUCSON',
      MarcaNombre: 'Hyundai',
      ModeloNombre: 'Tucson',
      Ano: '2023',
      Motor: 'MOT-DT-002',
      Placa: 'DT-TEST-02',
      Vin: 'KM8J3CA46NU0DT002',
      Color: 'GRIS',
      Pasajero: 5,
      Puerta: 4,
    },
  },
  {
    label: 'basic',
    name: 'DT Test #3 — Plan Básico (1000) cuotas',
    person: {
      PrimerNombre: 'Jose',
      PrimerApellido: 'Perez',
      SegundoNombre: '',
      SegundoApellido: 'Diaz',
      Identificacion: '8-888-1003',
      FechaNacimiento: '10/11/1978',
      Sexo: 'M',
      Email: 'jose.test@example.com',
      Telefono: 67001003,
      Celular: 67001003,
      Direccion: 'El Dorado, Panama',
      esPEP: 0,
      Ocupacion: 99,
      Acreedor: '',
      sumaAsegurada: 0,
      Uso: '10',
      Marca: 'KIA',
      Modelo: 'SPORTAGE',
      MarcaNombre: 'Kia',
      ModeloNombre: 'Sportage',
      Ano: '2021',
      Motor: 'MOT-DT-003',
      Placa: 'DT-TEST-03',
      Vin: 'KNDPN3AC5L7DT0003',
      Color: 'NEGRO',
      Pasajero: 5,
      Puerta: 4,
    },
  },
];

// Create a small dummy PDF file for document upload
function createDummyFile() {
  // Minimal valid PDF
  const pdfContent = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF',
    'utf-8'
  );
  return pdfContent;
}

async function uploadDocuments(env) {
  console.log(`  📤 Uploading documents (env=${env})...`);
  
  const pdfBuffer = createDummyFile();
  
  const formData = new FormData();
  formData.append('environment', env);
  
  // Create Blob-based files (Node 22 native)
  const cedulaBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const licenciaBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  
  formData.append('documento_identidad', cedulaBlob, 'documento_identidad.pdf');
  formData.append('licencia_conducir', licenciaBlob, 'licencia_conducir.pdf');
  
  const res = await fetch(`${BASE}/api/fedpa/documentos/upload`, {
    method: 'POST',
    body: formData,
  });
  
  const data = await res.json();
  console.log(`  📤 Upload response (${res.status}):`, JSON.stringify(data).substring(0, 300));
  return data;
}

async function emitPolicy(emissionData) {
  console.log(`  🏛️ Emitting policy (Plan=${emissionData.Plan}, env=${emissionData.environment})...`);
  
  const res = await fetch(`${BASE}/api/fedpa/emision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emissionData),
  });
  
  const data = await res.json();
  console.log(`  🏛️ Emission response (${res.status}):`, JSON.stringify(data).substring(0, 500));
  return { status: res.status, ...data };
}

async function downloadCaratula(poliza, env) {
  console.log(`  📄 Downloading carátula for ${poliza} (env=${env})...`);
  
  const res = await fetch(`${BASE}/api/fedpa/caratula`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ poliza, environment: env }),
  });
  
  const contentType = res.headers.get('content-type') || '';
  console.log(`  📄 Carátula response: status=${res.status}, content-type=${contentType}`);
  
  if (contentType.includes('application/pdf')) {
    const buffer = await res.arrayBuffer();
    console.log(`  ✅ PDF received! Size: ${buffer.byteLength} bytes`);
    return { success: true, isPdf: true, size: buffer.byteLength };
  } else {
    const data = await res.json();
    console.log(`  📄 Carátula JSON response:`, JSON.stringify(data).substring(0, 300));
    return { success: data.success || false, isPdf: false, data };
  }
}

// ── Step 0: Fetch real cotización to get exact premiums + idCotizacion ──
async function fetchCotizacion() {
  console.log('  📊 Fetching DT cotización from /api/fedpa/third-party ...');
  const res = await fetch(`${BASE}/api/fedpa/third-party`);
  const data = await res.json();
  console.log(`  📊 Cotización response (${res.status}): success=${data.success}, plans=${data.plans?.length}`);
  if (!data.success) throw new Error(`Cotización failed: ${data.error}`);

  for (const p of data.plans) {
    console.log(`     Plan ${p.emissionPlanCode} (${p.planType}): premium=${p.annualPremium}, exact=${p.annualPremiumExact}, idCot=${p.idCotizacion}`);
  }
  return data;
}

async function runTest(testPerson, index, cotizData) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  TEST ${index + 1}: ${testPerson.name}`);
  console.log(`${'═'.repeat(70)}`);

  // Pick the right plan from cotización
  const plan = cotizData.plans.find(p => p.planType === testPerson.label);
  if (!plan) {
    console.log(`  ❌ No plan found for label "${testPerson.label}"`);
    return { name: testPerson.name, docUpload: null, emission: null, caratula: null, nroPoliza: null };
  }

  const emissionPlanCode = plan.emissionPlanCode; // 1000 or 1002
  const primaTotal = plan.annualPremiumExact || plan.annualPremium;
  const idCotizacion = plan.idCotizacion;
  const cantidadPago = testPerson.name.includes('cuotas') ? 2 : 1;

  console.log(`  → Using Plan=${emissionPlanCode}, PrimaTotal=${primaTotal}, IdCotizacion=${idCotizacion}, cantidadPago=${cantidadPago}`);

  const result = {
    name: testPerson.name,
    docUpload: null,
    emission: null,
    caratula: null,
    nroPoliza: null,
  };

  // Step 1: Upload documents
  try {
    const docsResult = await uploadDocuments('DEV');
    result.docUpload = docsResult;
    if (!docsResult.success) {
      console.log(`  ❌ Document upload failed: ${docsResult.error}`);
      return result;
    }
    console.log(`  ✅ Documents uploaded: idDoc=${docsResult.idDoc}`);
  } catch (err) {
    console.log(`  ❌ Document upload error: ${err.message}`);
    result.docUpload = { success: false, error: err.message };
    return result;
  }

  // Step 2: Emit policy
  try {
    const emissionData = {
      environment: 'DEV',
      Plan: emissionPlanCode,
      IdCotizacion: String(idCotizacion),
      idDoc: result.docUpload.idDoc,
      ...testPerson.person,
      PrimaTotal: primaTotal,
      cantidadPago,
    };
    const emisionResult = await emitPolicy(emissionData);
    result.emission = emisionResult;
    if (!emisionResult.success) {
      console.log(`  ❌ Emission failed: ${emisionResult.error}`);
      return result;
    }
    result.nroPoliza = emisionResult.nroPoliza || emisionResult.poliza;
    console.log(`  ✅ Policy emitted: ${result.nroPoliza}`);
    console.log(`     amb=${emisionResult.amb}, vigencia: ${emisionResult.desde || emisionResult.vigenciaDesde} → ${emisionResult.hasta || emisionResult.vigenciaHasta}`);
  } catch (err) {
    console.log(`  ❌ Emission error: ${err.message}`);
    result.emission = { success: false, error: err.message };
    return result;
  }

  // Step 3: Download carátula
  try {
    const amb = result.emission.amb || 'DEV';
    const caratulaResult = await downloadCaratula(result.nroPoliza, amb);
    result.caratula = caratulaResult;
    if (caratulaResult.isPdf) {
      console.log(`  ✅ Carátula PDF downloaded successfully! (${caratulaResult.size} bytes)`);
    } else if (caratulaResult.success) {
      console.log(`  ⚠️ Carátula returned success but not PDF`);
    } else {
      console.log(`  ❌ Carátula download failed: ${caratulaResult.data?.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.log(`  ❌ Carátula download error: ${err.message}`);
    result.caratula = { success: false, error: err.message };
  }

  return result;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  FEDPA DT Emission + Carátula Download Test                ║');
  console.log('║  Environment: DEV (EmisorPlan 2024)                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Step 0: Get real cotización data
  let cotizData;
  try {
    cotizData = await fetchCotizacion();
  } catch (err) {
    console.error(`\n❌ Fatal: Could not fetch cotización: ${err.message}`);
    process.exit(1);
  }

  const results = [];
  for (let i = 0; i < testPersons.length; i++) {
    const result = await runTest(testPersons[i], i, cotizData);
    results.push(result);

    if (result.docUpload && result.docUpload.code === 'TOKEN_NOT_AVAILABLE') {
      console.log('\n⏳ Token blocked — skipping remaining tests');
      break;
    }
    if (i < testPersons.length - 1) {
      console.log('\n  ⏱️ Waiting 2s before next test...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(70)}`);
  console.log('  SUMMARY');
  console.log(`${'═'.repeat(70)}`);
  for (const r of results) {
    const docOk = r.docUpload?.success ? '✅' : '❌';
    const emiOk = r.emission?.success ? '✅' : '❌';
    const carOk = r.caratula?.isPdf ? '✅ PDF' : (r.caratula?.success ? '⚠️' : '❌');
    console.log(`  ${r.name}`);
    console.log(`    Docs: ${docOk} | Emission: ${emiOk} | Carátula: ${carOk} | Póliza: ${r.nroPoliza || 'N/A'}`);
  }
  const emitted = results.filter(r => r.emission?.success);
  const pdfs = results.filter(r => r.caratula?.isPdf);
  console.log(`\n  Total: ${results.length} tests | ${emitted.length} emitted | ${pdfs.length} carátulas PDF`);

  if (emitted.length > 0 && pdfs.length === 0) {
    console.log('\n  ⚠️ ALL emissions succeeded but NO carátulas returned PDF.');
    console.log('  This confirms DEV policies cannot download carátulas via Broker Integration.');
    console.log('  The confirmation page should handle this gracefully with HTML fallback.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
