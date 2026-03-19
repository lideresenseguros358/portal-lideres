/**
 * E2E Test: Internacional de Seguros — Full Emission Flow
 * 
 * Tests 3 DT + 3 CC emissions with the complete flow:
 *   1. Generate quote (POST /api/is/auto/quote)
 *   2. Emit policy (POST /api/is/auto/emitir)
 *   3. ADM COT payment tracking (via createPaymentOnEmission logic)
 *   4. Send expediente + welcome email (POST /api/is/auto/send-expediente)
 *   5. Collect policy numbers + carátula URLs
 * 
 * IS is already connected in PROD — uses production credentials.
 * 
 * Usage: node _test_e2e_is_full.js
 */

const BASE = 'http://localhost:3000';

// ── Test data ──
// IS Plan codes for DT
const PLAN_SOAT = 306;       // SOBAT 5/10 (Básico) — codGrupoTarifa=20
const PLAN_INTERMEDIO = 307;  // DAT 10/20 (Intermedio) — codGrupoTarifa=20

// IS CC plan codes — we'll use a common CC plan
// codPlanCobertura for CC: typically 1 (Completa) — codGrupoTarifa=20
const PLAN_CC = 1;

// Vehicle codes (IS catalog) — Toyota Corolla (verified in IS catalog)
const VEHICLE = {
  codMarca: 156,     // TOYOTA
  codModelo: 2563,   // COROLLA
  anio: 2022,
  codGrupoTarifa: 20,
  valorVehiculo: 15000,
};

// Generate unique test data for each run
function generateTestClient(index, type) {
  const ts = Date.now().toString().slice(-6);
  const names = [
    { nombre: 'Carlos', apellido1: 'Mendez', apellido2: 'Rivera' },
    { nombre: 'Maria', apellido1: 'Gonzalez', apellido2: 'Perez' },
    { nombre: 'Roberto', apellido1: 'Castillo', apellido2: 'Herrera' },
    { nombre: 'Ana', apellido1: 'Morales', apellido2: 'Vargas' },
    { nombre: 'Luis', apellido1: 'Fernandez', apellido2: 'Torres' },
    { nombre: 'Sofia', apellido1: 'Ramirez', apellido2: 'Cruz' },
  ];
  const n = names[index % names.length];
  // Use test cédulas that won't conflict with real clients
  const cedula = `8-${900 + index}-${parseInt(ts) + index}`;
  // Use unique plates per test to avoid "vehicle already associated" errors
  const platePrefix = type === 'DT' ? 'TD' : 'TC';
  const placa = `${platePrefix}${ts.slice(0, 4)}${index}`;
  const vin = `VIN${type}${ts}${index}X`;
  const motor = `MOT${type}${ts}${index}`;

  return {
    ...n,
    cedula,
    email: 'contacto@lideresenseguros.com', // Test email — goes to office
    telefono: '62900000',
    celular: '62900001',
    fechaNacimiento: '1990-05-15',
    sexo: index % 2 === 0 ? 'M' : 'F',
    direccion: 'Ciudad de Panamá, prueba E2E',
    estadoCivil: 'soltero',
    codProvincia: 8,
    codDistrito: 1,
    codCorregimiento: 1,
    placa,
    motor,
    vinChasis: vin,
    color: 'BLANCO',
    tipoTransmision: 'AUTOMATICO',
    pasajeros: 5,
    puertas: 4,
  };
}

// ── Helpers ──
async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, data: { raw: text.slice(0, 500) } };
  }
}

async function postFormData(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
  });
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, data: { raw: text.slice(0, 500) } };
  }
}

function convertDateToDDMMYYYY(dateStr) {
  // YYYY-MM-DD → dd/MM/yyyy
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Results collector ──
const results = [];

// ══════════════════════════════════════════════════════
// STEP 1: QUOTE — Generate IS quotation
// ══════════════════════════════════════════════════════
async function generateQuote(client, type, planCode) {
  console.log(`\n📋 [${type}] Generating quote for ${client.nombre} ${client.apellido1}...`);
  
  const quoteBody = {
    codTipoDoc: 1,
    nroDoc: client.cedula,
    nroNit: client.cedula,
    nombre: client.nombre,
    apellido: `${client.apellido1} ${client.apellido2}`,
    telefono: client.telefono,
    correo: client.email,
    codMarca: VEHICLE.codMarca,
    codModelo: VEHICLE.codModelo,
    anioAuto: String(VEHICLE.anio),
    sumaAseg: type === 'CC' ? String(VEHICLE.valorVehiculo) : '0',
    codPlanCobertura: planCode,
    codPlanCoberturaAdic: 0,
    codGrupoTarifa: VEHICLE.codGrupoTarifa,
    fecNacimiento: convertDateToDDMMYYYY(client.fechaNacimiento),
    codProvincia: client.codProvincia,
  };

  const res = await postJson('/api/is/auto/quote', quoteBody);
  
  if (!res.ok || !res.data.success) {
    console.error(`  ❌ Quote failed:`, res.data.error || res.data);
    return null;
  }

  console.log(`  ✅ Quote generated: idCotizacion=${res.data.idCotizacion}, prima=${res.data.primaTotal}`);
  return {
    idCotizacion: res.data.idCotizacion,
    primaTotal: res.data.primaTotal,
  };
}

// ══════════════════════════════════════════════════════
// STEP 2: EMIT — Emit policy via IS API
// ══════════════════════════════════════════════════════
async function emitPolicy(client, type, quote, planCode, cuotas = 1) {
  console.log(`\n🔐 [${type}] Emitting policy (cuotas=${cuotas})...`);
  
  const emitBody = {
    vIdPv: quote.idCotizacion,
    vcodtipodoc: 1,
    vnrodoc: client.cedula,
    vnombre: client.nombre,
    vapellido1: client.apellido1,
    vapellido2: client.apellido2,
    vtelefono: client.telefono,
    vcelular: client.celular,
    vcorreo: client.email,
    vfecnacimiento: convertDateToDDMMYYYY(client.fechaNacimiento),
    vsexo: client.sexo,
    vdireccion: client.direccion,
    vestadocivil: client.estadoCivil,
    vcodprovincia: client.codProvincia,
    vcoddistrito: client.codDistrito,
    vcodcorregimiento: client.codCorregimiento,
    vcodurbanizacion: 0,
    vcasaapto: '',
    vcodmarca: VEHICLE.codMarca,
    vmarca_label: 'TOYOTA',
    vcodmodelo: VEHICLE.codModelo,
    vmodelo_label: 'COROLLA',
    vanioauto: VEHICLE.anio,
    vsumaaseg: type === 'CC' ? VEHICLE.valorVehiculo : 0,
    vcodplancobertura: planCode,
    vcodgrupotarifa: VEHICLE.codGrupoTarifa,
    vplaca: client.placa,
    vmotor: client.motor,
    vchasis: client.vinChasis,
    vcolor: client.color,
    vtipotransmision: client.tipoTransmision,
    vcantpasajeros: client.pasajeros,
    vcantpuertas: client.puertas,
    formaPago: cuotas === 1 ? 1 : 2, // 1=Contado, 2=Financiado
    cantCuotas: cuotas,
    opcion: 1, // Deducible option 1 (low)
    pjeBexp: 0, // No buena experiencia discount
    vacreedor: '',
    tipo_cobertura: type === 'DT' ? 'Daños a Terceros' : 'Cobertura Completa',
  };

  const res = await postJson('/api/is/auto/emitir', emitBody);
  
  if (!res.ok || !res.data.success) {
    console.error(`  ❌ Emission failed:`, res.data.error || res.data);
    return null;
  }

  console.log(`  ✅ Policy emitted: ${res.data.nroPoliza}`);
  console.log(`     PDF URL: ${res.data.pdfUrl || 'N/A'}`);
  console.log(`     Client ID: ${res.data.clientId || 'N/A'}`);
  console.log(`     Policy ID: ${res.data.policyId || 'N/A'}`);
  
  return {
    nroPoliza: res.data.nroPoliza,
    pdfUrl: res.data.pdfUrl || '',
    clientId: res.data.clientId || '',
    policyId: res.data.policyId || '',
  };
}

// ══════════════════════════════════════════════════════
// STEP 3: ADM COT — Create payment + recurrence
// ══════════════════════════════════════════════════════
async function createAdmCotPayment(client, type, emission, prima, cuotas) {
  console.log(`\n💰 [${type}] Creating ADM COT payment (cuotas=${cuotas})...`);
  
  // Compute frequency
  let frequency;
  if (cuotas <= 1) frequency = 'CONTADO';
  else if (cuotas === 2) frequency = 'SEMESTRAL';
  else frequency = 'MENSUAL';
  
  const baseAmount = Math.floor((prima / cuotas) * 100) / 100;
  const today = new Date().toISOString().slice(0, 10);
  
  // Create first payment
  const payRes = await postJson('/api/adm-cot/payments', {
    action: 'create_pending',
    data: {
      insurer: 'INTERNACIONAL',
      policy_number: emission.nroPoliza,
      insured_name: `${client.nombre} ${client.apellido1}`,
      cedula: client.cedula,
      amount_due: baseAmount,
      payment_date: today,
      type: 'PAY_TO_INSURER',
      ramo: 'AUTO',
      installment_num: 1,
      total_installments: cuotas,
      payment_mode: cuotas <= 1 ? 'contado' : 'cuotas',
      source: 'EMISSION',
    },
  });
  
  if (!payRes.ok) {
    console.error(`  ⚠️ Payment creation failed:`, payRes.data);
  } else {
    console.log(`  ✅ Payment created`);
  }
  
  // Create recurrence if cuotas > 1
  if (cuotas > 1) {
    const freqMonths = cuotas === 2 ? 6 : Math.max(1, Math.floor(12 / cuotas));
    const schedule = [];
    const startDate = new Date();
    for (let i = 1; i <= cuotas; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1) * freqMonths);
      schedule.push({
        num: i,
        due_date: dueDate.toISOString().slice(0, 10),
        status: i === 1 ? 'PAGADO' : 'PENDIENTE',
        amount: baseAmount,
        payment_id: null,
      });
    }
    
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    const nextDue = new Date(startDate);
    nextDue.setMonth(nextDue.getMonth() + freqMonths);
    
    const recRes = await postJson('/api/adm-cot/payments', {
      action: 'create_recurrence',
      data: {
        nro_poliza: emission.nroPoliza,
        client_name: `${client.nombre} ${client.apellido1}`,
        cedula: client.cedula,
        insurer: 'INTERNACIONAL',
        total_installments: cuotas,
        frequency,
        installment_amount: baseAmount,
        start_date: today,
        end_date: endDate.toISOString().slice(0, 10),
        next_due_date: nextDue.toISOString().slice(0, 10),
        schedule,
      },
    });
    
    if (!recRes.ok) {
      console.error(`  ⚠️ Recurrence creation failed:`, recRes.data);
    } else {
      console.log(`  ✅ Recurrence created (${cuotas} cuotas, ${frequency})`);
    }
  }
}

// ══════════════════════════════════════════════════════
// STEP 4: SEND EXPEDIENTE + WELCOME EMAIL
// ══════════════════════════════════════════════════════
async function sendExpedienteAndWelcome(client, type, emission, quote, cuotas, prima) {
  console.log(`\n📧 [${type}] Sending expediente + welcome email...`);
  
  const isCC = type === 'CC';
  const coberturaLabel = isCC ? 'Cobertura Completa' : 'Daños a Terceros';
  const montoCuota = cuotas > 1 ? Math.round((prima / cuotas) * 100) / 100 : undefined;
  
  // Build FormData (same structure as the UI sends)
  const formData = new FormData();
  formData.append('tipoCobertura', isCC ? 'CC' : 'DT');
  formData.append('environment', 'production'); // IS is in PROD
  formData.append('nroPoliza', emission.nroPoliza);
  formData.append('pdfUrl', emission.pdfUrl || '');
  formData.append('insurerName', 'Internacional de Seguros');
  formData.append('firmaDataUrl', ''); // No signature in test
  if (emission.clientId) formData.append('clientId', emission.clientId);
  if (emission.policyId) formData.append('policyId', emission.policyId);
  
  formData.append('clientData', JSON.stringify({
    primerNombre: client.nombre,
    segundoNombre: '',
    primerApellido: client.apellido1,
    segundoApellido: client.apellido2,
    cedula: client.cedula,
    email: client.email,
    telefono: client.telefono,
    celular: client.celular,
    direccion: client.direccion,
    fechaNacimiento: client.fechaNacimiento,
    sexo: client.sexo,
    estadoCivil: client.estadoCivil,
  }));
  
  formData.append('vehicleData', JSON.stringify({
    placa: client.placa,
    vinChasis: client.vinChasis,
    motor: client.motor,
    color: client.color,
    pasajeros: client.pasajeros,
    puertas: client.puertas,
    tipoTransmision: client.tipoTransmision,
    marca: 'TOYOTA',
    modelo: 'COROLLA',
    anio: VEHICLE.anio,
  }));
  
  formData.append('quoteData', JSON.stringify({
    marca: 'TOYOTA',
    modelo: 'COROLLA',
    anio: VEHICLE.anio,
    valorVehiculo: isCC ? VEHICLE.valorVehiculo : 0,
    cobertura: coberturaLabel,
    primaTotal: prima,
    primaContado: prima,
    formaPago: cuotas > 1 ? 'cuotas' : 'contado',
    cantidadCuotas: cuotas,
    montoCuota: montoCuota,
    // IS supports cuotas natively — NO insurerPaymentPlan mismatch needed
  }));
  
  // No file attachments in test (cédula, licencia, etc.)
  // The expediente will still be sent but without document files
  
  const res = await postFormData('/api/is/auto/send-expediente', formData);
  
  if (!res.ok || !res.data.success) {
    console.error(`  ❌ Expediente failed:`, res.data.error || res.data);
    return false;
  }
  
  console.log(`  ✅ Expediente enviado — messageId: ${res.data.messageId}`);
  console.log(`     Recipients: ${JSON.stringify(res.data.recipients)}`);
  console.log(`     Client email sent: ${res.data.clientEmailSent}`);
  console.log(`     Attachments: ${res.data.attachmentCount}`);
  return true;
}

// ══════════════════════════════════════════════════════
// FULL FLOW: Quote → Emit → ADM COT → Expediente
// ══════════════════════════════════════════════════════
async function runFullFlow(index, type, planCode, cuotas = 1) {
  const client = generateTestClient(index, type);
  const testLabel = `${type} #${index + 1} (Plan ${planCode}, ${cuotas} cuota${cuotas > 1 ? 's' : ''})`;
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🚀 TEST: ${testLabel}`);
  console.log(`   Client: ${client.nombre} ${client.apellido1} ${client.apellido2}`);
  console.log(`   Cédula: ${client.cedula}`);
  console.log(`   Placa: ${client.placa}`);
  console.log(`${'═'.repeat(60)}`);
  
  const result = {
    test: testLabel,
    type,
    planCode,
    cuotas,
    client: `${client.nombre} ${client.apellido1}`,
    cedula: client.cedula,
    placa: client.placa,
    quoteId: null,
    prima: null,
    nroPoliza: null,
    pdfUrl: null,
    caratulaUrl: null,
    expedienteSent: false,
    success: false,
    error: null,
  };
  
  try {
    // 1. Quote
    const quote = await generateQuote(client, type, planCode);
    if (!quote) {
      result.error = 'Quote generation failed';
      results.push(result);
      return;
    }
    result.quoteId = quote.idCotizacion;
    result.prima = quote.primaTotal;
    
    // Small delay between quote and emission (IS needs time to process)
    await sleep(2000);
    
    // 2. Emit
    const emission = await emitPolicy(client, type, quote, planCode, cuotas);
    if (!emission) {
      result.error = 'Emission failed';
      results.push(result);
      return;
    }
    result.nroPoliza = emission.nroPoliza;
    result.pdfUrl = emission.pdfUrl;
    
    // Build carátula URL (IS provides LinkDescarga directly)
    // If pdfUrl is a relative path, make it absolute
    if (emission.pdfUrl) {
      result.caratulaUrl = emission.pdfUrl.startsWith('http') 
        ? emission.pdfUrl 
        : `${BASE}${emission.pdfUrl}`;
    }
    
    // Small delay before ADM COT
    await sleep(1000);
    
    // 3. ADM COT
    const prima = quote.primaTotal || 150;
    await createAdmCotPayment(client, type, emission, prima, cuotas);
    
    // Small delay before expediente
    await sleep(1000);
    
    // 4. Send Expediente + Welcome Email
    const expOk = await sendExpedienteAndWelcome(client, type, emission, quote, cuotas, prima);
    result.expedienteSent = expOk;
    
    result.success = true;
    console.log(`\n✅ ${testLabel} — COMPLETED SUCCESSFULLY`);
    console.log(`   Póliza: ${result.nroPoliza}`);
    console.log(`   Carátula: ${result.caratulaUrl || 'N/A'}`);
    
  } catch (err) {
    result.error = err.message || String(err);
    console.error(`\n❌ ${testLabel} — FAILED: ${result.error}`);
  }
  
  results.push(result);
}

// ══════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  E2E TEST: Internacional de Seguros — Full Emission     ║');
  console.log('║  3 DT + 3 CC emissions (PROD environment)              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nServer: ${BASE}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  // ═══ 3 DT EMISSIONS ═══
  // DT #1: Plan SOAT Básico (306), contado
  await runFullFlow(0, 'DT', PLAN_SOAT, 1);
  await sleep(3000);
  
  // DT #2: Plan SOAT Básico (306), contado (different client)
  await runFullFlow(1, 'DT', PLAN_SOAT, 1);
  await sleep(3000);
  
  // DT #3: Plan Intermedio (307), contado
  await runFullFlow(2, 'DT', PLAN_INTERMEDIO, 1);
  await sleep(3000);
  
  // ═══ 3 CC EMISSIONS ═══
  // CC #1: Plan CC (1), contado
  await runFullFlow(3, 'CC', PLAN_CC, 1);
  await sleep(3000);
  
  // CC #2: Plan CC (1), 2 cuotas
  await runFullFlow(4, 'CC', PLAN_CC, 2);
  await sleep(3000);
  
  // CC #3: Plan CC (1), 4 cuotas
  await runFullFlow(5, 'CC', PLAN_CC, 4);
  
  // ═══ FINAL REPORT ═══
  console.log('\n\n' + '═'.repeat(70));
  console.log('                        FINAL REPORT');
  console.log('═'.repeat(70));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\nTotal: ${results.length} | ✅ Success: ${successful.length} | ❌ Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n┌──────────────────────────────────────────────────────────────┐');
    console.log('│                    PÓLIZAS EMITIDAS                          │');
    console.log('├──────────────────────────────────────────────────────────────┤');
    for (const r of successful) {
      console.log(`│ ${r.type} | Póliza: ${(r.nroPoliza || '').padEnd(20)} | Prima: $${r.prima || 'N/A'}`);
      console.log(`│     Carátula: ${r.caratulaUrl || 'N/A'}`);
      console.log(`│     Cliente: ${r.client} (${r.cedula})`);
      console.log(`│     Cuotas: ${r.cuotas} | Expediente: ${r.expedienteSent ? '✅' : '❌'}`);
      console.log('├──────────────────────────────────────────────────────────────┤');
    }
    console.log('└──────────────────────────────────────────────────────────────┘');
  }
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    for (const r of failed) {
      console.log(`  - ${r.test}: ${r.error}`);
    }
  }
  
  // Output structured results for easy copying
  console.log('\n\n📋 STRUCTURED RESULTS (for deletion request to IS):');
  console.log(JSON.stringify(results.map(r => ({
    tipo: r.type,
    poliza: r.nroPoliza,
    prima: r.prima,
    cuotas: r.cuotas,
    caratula: r.caratulaUrl,
    cliente: r.client,
    cedula: r.cedula,
    placa: r.placa,
    success: r.success,
    error: r.error,
  })), null, 2));
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
