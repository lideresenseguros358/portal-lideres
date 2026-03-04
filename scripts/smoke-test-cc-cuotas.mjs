/**
 * E2E Smoke Test: FedPa CC Emissions with cantidadPago 1-10
 * 
 * Tests the full emission flow for CC plans using the range-based
 * plan resolver (461/462/463) with all 10 cuota options.
 * 
 * Usage: node scripts/smoke-test-cc-cuotas.mjs
 */

const BASE_URL = 'http://localhost:3000';

// Step 1: Upload test documents to get idDoc
async function uploadDocuments() {
  console.log('\n═══ STEP 1: Uploading test documents ═══');
  const pdfBytes = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n' +
    '0000000058 00000 n \n0000000115 00000 n \n' +
    'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
  );
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  const fd = new FormData();
  fd.append('environment', 'DEV');
  fd.append('documento_identidad', blob, 'cedula.pdf');
  fd.append('licencia_conducir', blob, 'licencia.pdf');

  const res = await fetch(`${BASE_URL}/api/fedpa/documentos/upload`, {
    method: 'POST',
    body: fd,
  });
  const data = await res.json();
  if (!data.success) throw new Error(`Upload failed: ${data.error}`);
  console.log(`  ✓ Documents uploaded. idDoc: ${data.idDoc}`);
  return data.idDoc;
}

// Step 2: Get a cotización for a CC plan
async function getCotizacion(planId, sumaAsegurada) {
  console.log(`\n═══ STEP 2: Cotización plan=${planId} suma=$${sumaAsegurada} ═══`);
  const res = await fetch(`${BASE_URL}/api/fedpa/cotizacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vcodtipodoc: 1,
      vnrodoc: '8-999-9999',
      vnombre: 'SMOKE',
      vapellido: 'TEST',
      vtelefono: '60001234',
      vcorreo: 'smoke@test.com',
      vcodmarca: 156,
      vcodmodelo: 2469,
      marca: 'TOYOTA',
      modelo: 'COROLLA',
      vanioauto: 2024,
      vsumaaseg: sumaAsegurada,
      vcodplancobertura: planId,
      vcodgrupotarifa: 1,
      lesionCorporalPersona: 10000,
      lesionCorporalAccidente: 20000,
      danoPropiedad: 10000,
      gastosMedicosPersona: 2000,
      gastosMedicosAccidente: 10000,
      deducible: 'medio',
      EndosoIncluido: 'S',
      environment: 'DEV',
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`Cotización failed: ${data.error}`);
  console.log(`  ✓ Cotización: id=${data.idCotizacion} prima=$${data.primaTotal}`);
  return { idCotizacion: data.idCotizacion, primaTotal: data.primaTotal };
}

// Step 3: Emit policy with specific cantidadPago
async function emitirPoliza(idDoc, idCotizacion, planId, primaTotal, cantidadPago, sumaAsegurada) {
  const payload = {
    environment: 'DEV',
    IdCotizacion: idCotizacion,
    Plan: planId,
    idDoc,
    PrimerNombre: 'SMOKE',
    PrimerApellido: 'TEST',
    SegundoNombre: '',
    SegundoApellido: '',
    Identificacion: '8-999-9999',
    FechaNacimiento: '01/01/1990',
    Sexo: 'M',
    Email: 'smoke@test.com',
    Telefono: 60001234,
    Celular: 60001234,
    Direccion: 'PANAMA CITY TEST',
    esPEP: 0,
    Ocupacion: '99',
    Acreedor: '',
    sumaAsegurada,
    Uso: '10',
    Marca: 'TOY',
    Modelo: 'COROLLA',
    MarcaNombre: 'TOYOTA',
    ModeloNombre: 'COROLLA',
    Ano: '2024',
    Motor: 'TEST123456',
    Placa: 'TST999',
    Vin: 'TEST12345678901234',
    Color: 'BLANCO',
    Pasajero: 5,
    Puerta: 4,
    PrimaTotal: primaTotal, // Always contado price
    cantidadPago,
  };

  const res = await fetch(`${BASE_URL}/api/fedpa/emision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return data;
}

// Main test runner
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  SMOKE TEST: FedPa CC — cantidadPago 1-10      ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const results = [];
  const sumaAsegurada = 15000; // Falls into plan 461 range ($3K-$20K)
  const planId = 461;

  try {
    // Upload docs once
    const idDoc = await uploadDocuments();

    // Get a fresh cotización
    const { idCotizacion, primaTotal } = await getCotizacion(planId, sumaAsegurada);

    console.log(`\n═══ STEP 3: Testing emissions with cantidadPago 1-10 ═══`);
    console.log(`  Plan: ${planId} | Prima contado: $${primaTotal} | IdCot: ${idCotizacion}\n`);

    for (let cuotas = 1; cuotas <= 10; cuotas++) {
      // Need a fresh cotización for each emission (FedPa consumes the cotización ID)
      const cot = await getCotizacion(planId, sumaAsegurada);
      
      process.stdout.write(`  [${cuotas}/10] cantidadPago=${cuotas}... `);
      const start = Date.now();
      const result = await emitirPoliza(
        idDoc, cot.idCotizacion, planId, cot.primaTotal, cuotas, sumaAsegurada
      );
      const elapsed = Date.now() - start;

      if (result.success) {
        console.log(`✓ Póliza: ${result.nroPoliza} (${elapsed}ms)`);
        results.push({ cuotas, success: true, poliza: result.nroPoliza, elapsed });
      } else {
        console.log(`✗ Error: ${result.error} (${elapsed}ms)`);
        results.push({ cuotas, success: false, error: result.error, elapsed });
      }

      // Small delay between emissions to avoid rate limiting
      await new Promise(r => setTimeout(r, 1500));
    }

    // Summary
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  RESULTS SUMMARY                                ║');
    console.log('╠══════════════════════════════════════════════════╣');
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    results.forEach(r => {
      const status = r.success ? '✓' : '✗';
      const detail = r.success ? `Póliza: ${r.poliza}` : `Error: ${r.error}`;
      console.log(`║  ${status} Cuotas ${String(r.cuotas).padStart(2)}: ${detail.substring(0, 42).padEnd(42)} ║`);
    });
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  PASSED: ${passed}/10  |  FAILED: ${failed}/10                   ║`);
    console.log('╚══════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
