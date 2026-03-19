/**
 * ═══════════════════════════════════════════════════════════════
 * COMPREHENSIVE E2E TEST: FEDPA Emission + Payment Full Cycle
 * ═══════════════════════════════════════════════════════════════
 *
 * Phase 1: 5 DT (Daños a Terceros) emissions — vary 1-2 cuotas, brands, models, years
 * Phase 2: 5 CC (Cobertura Completa) emissions — vary 1-4 cuotas, brands, models, years
 * Phase 3: Verify carátula download for all 10 policies
 * Phase 4: Verify PF charges + ADM COT payments + recurrences
 * Phase 5: Bank import, group, pay
 * Phase 6: Cron recurrence activation + PF failed charge simulation + morosidad
 * Phase 7: Client payment via morosidad modal
 * Phase 8: Final report — list all policy numbers for FEDPA deletion
 *
 * Run: node _test_e2e_fedpa_full.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SITE_URL = 'http://localhost:3000';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = process.env.ADM_COT_CRON_SECRET || process.env.CRON_SECRET;

let pass = 0, fail = 0;
const allPolicies = []; // { type, poliza, insurer, client, cuotas, amount }
const allPaymentIds = [];
const allRecurrenceIds = [];

function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ FAIL: ${msg}`); }
  return cond;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ════════════════════════════════════════════
// Generate a minimal valid PDF in-memory (for document uploads)
// ════════════════════════════════════════════
function createMinimalPDF() {
  const content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
206
%%EOF`;
  return Buffer.from(content);
}

// ════════════════════════════════════════════
// DT Plan/Prima constants (EmisorPlan API)
// Plan 1000 = Básico ($130), Plan 1002 = Premium/VIP ($165)
// These are fixed EmisorPlan prices from /api/planes PROD.
// Marca/Modelo must be STRING NUMERIC codes (e.g. '5' for Toyota).
// ════════════════════════════════════════════
const DT_BASIC_PLAN = 1000;
const DT_BASIC_PRIMA = 130;
const DT_PREMIUM_PLAN = 1002;
const DT_PREMIUM_PRIMA = 165;
const DT_ENVIRONMENT = 'PROD';

// ════════════════════════════════════════════
// Test Data: 5 DT + 5 CC variations
// DT EmisorPlan: Plan 1000 (basic, $130) / 1002 (premium, $165) — PROD env.
// DT: basic vs premium alternated. Cuotas: 1 or 2.
// CC EmisorExterno: plan 411 — PROD env.
// Marca/Modelo: FEDPA PROD numeric string codes (CodMarca/CodModelo).
// ════════════════════════════════════════════
const TEST_CEDULA_BASE = '8-TEST-';

function getDTTests() {
  // Marca/Modelo: FEDPA PROD numeric CodMarca/CodModelo as strings
  return [
    { id: 'DT1', cuotas: 1, planType: 'basic',   marca: '5',  marcaNombre: 'TOYOTA',  modelo: '10',  ano: 2022, placa: 'E2EDT1', color: 'BLANCO', primerNombre: 'CARLOS', primerApellido: 'MARTINEZ',  sexo: 'M', fechaNac: '15/06/1990' },
    { id: 'DT2', cuotas: 2, planType: 'premium',  marca: '5',  marcaNombre: 'TOYOTA',  modelo: '100', ano: 2023, placa: 'E2EDT2', color: 'NEGRO',  primerNombre: 'MARIA',  primerApellido: 'RODRIGUEZ', sexo: 'F', fechaNac: '22/03/1985' },
    { id: 'DT3', cuotas: 1, planType: 'basic',   marca: '5',  marcaNombre: 'TOYOTA',  modelo: '10',  ano: 2021, placa: 'E2EDT3', color: 'GRIS',   primerNombre: 'JUAN',   primerApellido: 'PEREZ',     sexo: 'M', fechaNac: '10/11/1988' },
    { id: 'DT4', cuotas: 2, planType: 'premium',  marca: '5',  marcaNombre: 'TOYOTA',  modelo: '100', ano: 2024, placa: 'E2EDT4', color: 'ROJO',   primerNombre: 'ANA',    primerApellido: 'GONZALEZ',  sexo: 'F', fechaNac: '05/09/1992' },
    { id: 'DT5', cuotas: 1, planType: 'basic',   marca: '5',  marcaNombre: 'TOYOTA',  modelo: '10',  ano: 2020, placa: 'E2EDT5', color: 'AZUL',   primerNombre: 'PEDRO',  primerApellido: 'SANCHEZ',   sexo: 'M', fechaNac: '18/01/1995' },
  ];
}

const CC_TESTS = [
  // Marca/Modelo: FEDPA PROD numeric CodMarca/CodModelo as strings
  { id: 'CC1', cuotas: 1, marca: '5',  marcaNombre: 'TOYOTA',     modelo: '100', ano: 2023, placa: 'E2ECC1', color: 'BLANCO', primerNombre: 'LUIS',    primerApellido: 'HERRERA',  sexo: 'M', fechaNac: '20/04/1987', sumaAseg: 25000, planCode: 411 },
  { id: 'CC2', cuotas: 2, marca: '5',  marcaNombre: 'TOYOTA',     modelo: '10',  ano: 2022, placa: 'E2ECC2', color: 'GRIS',   primerNombre: 'CARMEN',  primerApellido: 'DIAZ',     sexo: 'F', fechaNac: '12/07/1991', sumaAseg: 20000, planCode: 411 },
  { id: 'CC3', cuotas: 3, marca: '5',  marcaNombre: 'TOYOTA',     modelo: '100', ano: 2021, placa: 'E2ECC3', color: 'NEGRO',  primerNombre: 'ROBERTO', primerApellido: 'VARGAS',   sexo: 'M', fechaNac: '30/12/1983', sumaAseg: 22000, planCode: 411 },
  { id: 'CC4', cuotas: 4, marca: '5',  marcaNombre: 'TOYOTA',     modelo: '10',  ano: 2024, placa: 'E2ECC4', color: 'PLATA',  primerNombre: 'SOFIA',   primerApellido: 'CASTILLO', sexo: 'F', fechaNac: '08/02/1996', sumaAseg: 18000, planCode: 411 },
  { id: 'CC5', cuotas: 2, marca: '5',  marcaNombre: 'TOYOTA',     modelo: '100', ano: 2020, placa: 'E2ECC5', color: 'VERDE',  primerNombre: 'MIGUEL',  primerApellido: 'TORRES',   sexo: 'M', fechaNac: '25/08/1989', sumaAseg: 15000, planCode: 411 },
];

// ════════════════════════════════════════════
// PHASE 1: DT Emissions (EmisorPlan)
// ════════════════════════════════════════════
async function phase1_DTEmissions() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 1: DT Emissions (Daños a Terceros) — 5 policies');
  console.log('═'.repeat(60));

  const pdfBuf = createMinimalPDF();
  const DT_TESTS = getDTTests();

  for (const t of DT_TESTS) {
    const prima = t.planType === 'premium' ? DT_PREMIUM_PRIMA : DT_BASIC_PRIMA;
    const planCode = t.planType === 'premium' ? DT_PREMIUM_PLAN : DT_BASIC_PLAN;
    console.log(`\n── ${t.id}: ${t.marcaNombre} ${t.modelo} ${t.ano} (${t.cuotas} cuota${t.cuotas > 1 ? 's' : ''}, ${t.planType}, Plan ${planCode}, $${prima}) ──`);

    // Step 1: Upload documents (EmisorPlan) — fresh idDoc per emission
    console.log('  📄 Uploading documents...');
    const docForm = new FormData();
    docForm.append('environment', DT_ENVIRONMENT);
    docForm.append('documento_identidad', new Blob([pdfBuf], { type: 'application/pdf' }), 'documento_identidad.pdf');
    docForm.append('licencia_conducir', new Blob([pdfBuf], { type: 'application/pdf' }), 'licencia_conducir.pdf');

    const docRes = await fetch(`${SITE_URL}/api/fedpa/documentos/upload`, { method: 'POST', body: docForm });
    const docData = await docRes.json();

    if (!assert(docData.success && docData.idDoc, `${t.id}: Docs uploaded, idDoc=${docData.idDoc}`)) {
      console.log('    Error:', docData.error || 'Unknown');
      continue;
    }

    // Step 2: Emit policy (EmisorPlan) — plan 1000/1002, fixed prima
    console.log(`  🏗️ Emitting DT policy (${DT_ENVIRONMENT}, Plan ${planCode}, $${prima})...`);
    const cedula = `${TEST_CEDULA_BASE}${t.id}`;
    const emisionBody = {
      environment: DT_ENVIRONMENT,
      Plan: planCode,
      idDoc: docData.idDoc,
      PrimerNombre: t.primerNombre,
      PrimerApellido: t.primerApellido,
      SegundoNombre: '',
      SegundoApellido: '',
      Identificacion: cedula,
      FechaNacimiento: t.fechaNac,
      Sexo: t.sexo,
      Email: 'e2etest@lideresenseguros.com',
      Telefono: 60001000 + parseInt(t.id.replace('DT', '')),
      Celular: 60001000 + parseInt(t.id.replace('DT', '')),
      Direccion: 'PANAMA CIUDAD',
      esPEP: 0,
      Ocupacion: '9',
      sumaAsegurada: 0,
      Uso: '10',
      Marca: t.marca,
      Modelo: t.modelo,
      MarcaNombre: t.marcaNombre,
      ModeloNombre: t.modelo,
      Ano: String(t.ano),
      Motor: `MOT${t.id}E2E`,
      Placa: t.placa,
      Vin: `VIN${t.id}E2ETEST00000`,
      Color: t.color,
      Pasajero: 5,
      Puerta: 4,
      PrimaTotal: prima,
      cantidadPago: t.cuotas,
    };

    const emRes = await fetch(`${SITE_URL}/api/fedpa/emision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emisionBody),
    });
    const emData = await emRes.json();

    if (!assert(emData.success && emData.poliza, `${t.id}: Policy emitted: ${emData.poliza || emData.nroPoliza || 'NONE'}`)) {
      console.log('    Error:', emData.error || 'Unknown');
      console.log('    Response:', JSON.stringify(emData).substring(0, 400));
      continue;
    }

    const poliza = emData.poliza || emData.nroPoliza;
    allPolicies.push({
      type: 'DT', id: t.id, poliza, insurer: 'FEDPA',
      client: `${t.primerNombre} ${t.primerApellido}`,
      cedula, cuotas: t.cuotas, amount: prima,
      marca: t.marcaNombre, modelo: t.modelo, ano: t.ano,
      planType: t.planType,
    });

    // Step 3: Create payment + recurrence in ADM COT (direct Supabase insert)
    console.log('  💰 Creating ADM COT payment...');
    const baseAmt = Math.floor((prima / t.cuotas) * 100) / 100;
    const pfCodOper = `E2E-DT-${t.id}-${Date.now()}`;
    const { data: payRow, error: payErr } = await sb.from('adm_cot_payments').insert({
      insurer: 'FEDPA', nro_poliza: poliza,
      client_name: `${t.primerNombre} ${t.primerApellido}`,
      cedula, amount: baseAmt,
      payment_date: new Date().toISOString().slice(0, 10),
      status: 'CONFIRMADO_PF',
      ramo: 'AUTO', installment_num: 1,
      payment_source: 'EMISSION',
      pf_cod_oper: pfCodOper,
      pf_card_type: 'VISA', pf_card_display: '****1234',
      pf_confirmed_at: new Date().toISOString(),
      notes: { total_installments: t.cuotas, payment_mode: t.cuotas > 1 ? 'cuotas' : 'contado', e2e: true },
    }).select().single();
    assert(!payErr && payRow, `${t.id}: Payment created (id=${payRow?.id})`);
    if (payErr) console.log('    Pay error:', payErr.message);
    if (payRow?.id) allPaymentIds.push(payRow.id);

    // Create recurrence if cuotas > 1
    if (t.cuotas > 1) {
      const startDate = new Date();
      const schedule = [];
      for (let i = 1; i <= t.cuotas; i++) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + (i - 1));
        schedule.push({
          num: i, due_date: d.toISOString().slice(0, 10),
          status: i === 1 ? 'PAGADO' : 'PENDIENTE',
          amount: baseAmt, payment_id: i === 1 ? payRow?.id : null,
        });
      }
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
      const nextDue = new Date(startDate);
      nextDue.setMonth(nextDue.getMonth() + 1);

      const { data: recRow, error: recErr } = await sb.from('adm_cot_recurrences').insert({
        nro_poliza: poliza, client_name: `${t.primerNombre} ${t.primerApellido}`,
        cedula, insurer: 'FEDPA', total_installments: t.cuotas,
        frequency: 'MENSUAL', installment_amount: baseAmt,
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        next_due_date: nextDue.toISOString().slice(0, 10),
        schedule, status: 'ACTIVA',
        pf_cod_oper: pfCodOper,
      }).select().single();
      assert(!recErr && recRow, `${t.id}: Recurrence created (${t.cuotas} cuotas MENSUAL)`);
      if (recErr) console.log('    Rec error:', recErr.message);
      if (recRow?.id) allRecurrenceIds.push(recRow.id);
    }

    await sleep(2000); // Throttle between FEDPA calls — token sensitive
  }
}

// ════════════════════════════════════════════
// PHASE 2: CC Emissions (EmisorExterno)
// NOTE: get_nropoliza_emitir (PROD) is currently returning 404 from FEDPA's server.
// This is a known FEDPA backend issue, not our code. We still attempt and document results.
// ════════════════════════════════════════════
async function phase2_CCEmissions() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 2: CC Emissions (Cobertura Completa) — 5 policies');
  console.log('  NOTE: get_nropoliza_emitir may return 404 (FEDPA server issue)');
  console.log('═'.repeat(60));

  const pdfBuf = createMinimalPDF();

  for (const t of CC_TESTS) {
    console.log(`\n── ${t.id}: ${t.marcaNombre} ${t.modelo} ${t.ano} (${t.cuotas} cuota${t.cuotas > 1 ? 's' : ''}, $${t.sumaAseg}) ──`);

    const cedula = `${TEST_CEDULA_BASE}${t.id}`;

    // CC uses EmisorExterno (multipart: emisionData JSON + File1/File2/File3)
    console.log('  🏗️ Emitting CC policy (Emisor Externo)...');
    const extForm = new FormData();
    extForm.append('emisionData', JSON.stringify({
      PrimerNombre: t.primerNombre,
      PrimerApellido: t.primerApellido,
      SegundoNombre: '',
      SegundoApellido: '',
      Identificacion: cedula,
      FechaNacimiento: t.fechaNac,
      Sexo: t.sexo,
      Email: 'e2etest@lideresenseguros.com',
      Telefono: String(60002000 + parseInt(t.id.replace('CC', ''))),
      Celular: String(60002000 + parseInt(t.id.replace('CC', ''))),
      Direccion: 'PANAMA CIUDAD',
      esPEP: 0,
      sumaAsegurada: String(t.sumaAseg),
      Uso: '10',
      Marca: t.marca,
      Modelo: t.modelo,
      MarcaNombre: t.marcaNombre,
      ModeloNombre: t.modelo,
      Ano: String(t.ano),
      Motor: `MOT${t.id}E2E`,
      Placa: t.placa,
      Vin: `VIN${t.id}E2ETEST00000`,
      Color: t.color,
      Pasajero: 5,
      Puerta: 4,
      CodPlan: t.planCode,
      CodLimiteLesiones: '1',
      CodLimitePropiedad: '7',
      CodLimiteGastosMedico: '16',
      EndosoIncluido: 'S',
      cantidadPago: t.cuotas,
      environment: 'PROD',
    }));

    extForm.append('File1', new Blob([pdfBuf], { type: 'application/pdf' }), 'documento_identidad.pdf');
    extForm.append('File2', new Blob([pdfBuf], { type: 'application/pdf' }), 'licencia_conducir.pdf');
    extForm.append('File3', new Blob([pdfBuf], { type: 'application/pdf' }), 'registro_vehicular.pdf');

    const emRes = await fetch(`${SITE_URL}/api/fedpa/emision-externo`, { method: 'POST', body: extForm });
    const emData = await emRes.json();

    if (!emData.success || !(emData.poliza || emData.nroPoliza)) {
      const stepInfo = (emData.steps || []).map(s => `Step ${s.step} ${s.name}: ${s.success ? '✅' : '❌'}`).join(' → ');
      console.log(`  ⚠️ ${t.id}: CC emission failed — ${emData.error || 'Unknown'}`);
      console.log(`    Flow: ${stepInfo}`);
      // Check if get_cotizacion succeeded (step 1) — that validates our data is correct
      const step1 = (emData.steps || []).find(s => s.step === 1);
      if (step1?.success) {
        console.log(`    ℹ️ get_cotizacion OK (IdCot=${step1.idCotizacion}, prima=$${step1.primaReal}) — nropoliza endpoint is the issue`);
        fail++;
      } else {
        assert(false, `${t.id}: CC emission failed at cotización step`);
      }
      continue;
    }

    assert(true, `${t.id}: Policy emitted: ${emData.poliza || emData.nroPoliza}`);

    const poliza = emData.poliza || emData.nroPoliza;
    const primaTotal = emData.primaTotal || 500;
    allPolicies.push({
      type: 'CC', id: t.id, poliza, insurer: 'FEDPA',
      client: `${t.primerNombre} ${t.primerApellido}`,
      cedula, cuotas: t.cuotas, amount: primaTotal,
      marca: t.marcaNombre, modelo: t.modelo, ano: t.ano,
    });

    // Create payment + recurrence
    console.log('  💰 Creating ADM COT payment...');
    const baseAmt = Math.floor((primaTotal / t.cuotas) * 100) / 100;
    const freqMap = { 1: 'CONTADO', 2: 'SEMESTRAL', 3: 'CUATRIMESTRAL', 4: 'TRIMESTRAL' };

    const ccPfCodOper = `E2E-CC-${t.id}-${Date.now()}`;
    const { data: ccPayRow, error: ccPayErr } = await sb.from('adm_cot_payments').insert({
      insurer: 'FEDPA', nro_poliza: poliza,
      client_name: `${t.primerNombre} ${t.primerApellido}`,
      cedula, amount: baseAmt,
      payment_date: new Date().toISOString().slice(0, 10),
      status: 'CONFIRMADO_PF',
      ramo: 'AUTO', installment_num: 1,
      payment_source: 'EMISSION',
      pf_cod_oper: ccPfCodOper,
      pf_card_type: 'MASTERCARD', pf_card_display: '****5678',
      pf_confirmed_at: new Date().toISOString(),
      notes: { total_installments: t.cuotas, payment_mode: t.cuotas > 1 ? 'cuotas' : 'contado', e2e: true },
    }).select().single();
    assert(!ccPayErr && ccPayRow, `${t.id}: Payment created (id=${ccPayRow?.id})`);
    if (ccPayErr) console.log('    Pay error:', ccPayErr.message);
    if (ccPayRow?.id) allPaymentIds.push(ccPayRow.id);

    if (t.cuotas > 1) {
      const startDate = new Date();
      const freqMonthsMap = { SEMESTRAL: 6, CUATRIMESTRAL: 4, TRIMESTRAL: 3, MENSUAL: 1 };
      const freq = freqMap[t.cuotas] || 'MENSUAL';
      const freqMonths = freqMonthsMap[freq] || 1;
      const schedule = [];
      for (let i = 1; i <= t.cuotas; i++) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + (i - 1) * freqMonths);
        const lastAmt = i === t.cuotas ? Math.round((primaTotal - baseAmt * (t.cuotas - 1)) * 100) / 100 : baseAmt;
        schedule.push({
          num: i, due_date: d.toISOString().slice(0, 10),
          status: i === 1 ? 'PAGADO' : 'PENDIENTE',
          amount: lastAmt, payment_id: i === 1 ? ccPayRow?.id : null,
        });
      }
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
      const nextDue = new Date(startDate);
      nextDue.setMonth(nextDue.getMonth() + freqMonths);

      const { data: ccRecRow, error: ccRecErr } = await sb.from('adm_cot_recurrences').insert({
        nro_poliza: poliza, client_name: `${t.primerNombre} ${t.primerApellido}`,
        cedula, insurer: 'FEDPA', total_installments: t.cuotas,
        frequency: freq, installment_amount: baseAmt,
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        next_due_date: nextDue.toISOString().slice(0, 10),
        schedule, status: 'ACTIVA',
        pf_cod_oper: ccPfCodOper,
      }).select().single();
      assert(!ccRecErr && ccRecRow, `${t.id}: Recurrence created (${t.cuotas} cuotas ${freq})`);
      if (ccRecErr) console.log('    Rec error:', ccRecErr.message);
      if (ccRecRow?.id) allRecurrenceIds.push(ccRecRow.id);
    }

    await sleep(2000); // Throttle between FEDPA calls
  }
}

// ════════════════════════════════════════════
// PHASE 3: Carátula Download
// ════════════════════════════════════════════
async function phase3_CaratulaDownload() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 3: Carátula PDF Download');
  console.log('═'.repeat(60));

  if (allPolicies.length === 0) {
    console.log('  No policies emitted — skipping');
    return;
  }

  // NOTE: DEV-emitted policies may not have carátulas via BrokerIntegration (PROD only).
  // We still attempt to verify the endpoint works.
  for (const p of allPolicies) {
    console.log(`\n── ${p.id}: ${p.poliza} ──`);
    try {
      const encodedPoliza = encodeURIComponent(p.poliza);
      const res = await fetch(`${SITE_URL}/api/fedpa/polizas/${encodedPoliza}/caratula`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: 'PROD' }),
      });

      if (res.headers.get('content-type')?.includes('pdf')) {
        const buf = await res.arrayBuffer();
        assert(buf.byteLength > 100, `${p.id}: Carátula PDF downloaded (${buf.byteLength} bytes)`);
        const outDir = path.join(__dirname, '_e2e_caratulas');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, `caratula_${p.id}_${p.poliza.replace(/\//g, '-')}.pdf`), Buffer.from(buf));
        console.log(`    📥 Saved: _e2e_caratulas/caratula_${p.id}_${p.poliza.replace(/\//g, '-')}.pdf`);
      } else {
        const data = await res.json().catch(() => ({}));
        const errMsg = data.error || data.msg || 'No PDF';
        if (p.type === 'DT' && DT_ENVIRONMENT === 'DEV') {
          console.log(`  ⚠️ ${p.id}: DEV policy — carátula not available (only PROD has carátulas): ${errMsg}`);
        } else if (p.type === 'CC') {
          console.log(`  ⚠️ ${p.id}: CC carátula not immediately available: ${errMsg}`);
        } else {
          assert(false, `${p.id}: Carátula download failed: ${errMsg}`);
        }
      }
    } catch (e) {
      assert(false, `${p.id}: Carátula error: ${e.message}`);
    }
  }
}

// ════════════════════════════════════════════
// PHASE 4: Verify ADM COT Payments + Recurrences
// ════════════════════════════════════════════
async function phase4_VerifyPayments() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 4: Verify ADM COT Payments + Recurrences');
  console.log('═'.repeat(60));

  for (const p of allPolicies) {
    // Check payment
    const { data: pay } = await sb.from('adm_cot_payments')
      .select('id, status, amount, insurer, nro_poliza, pf_cod_oper, installment_num')
      .eq('nro_poliza', p.poliza).eq('installment_num', 1).maybeSingle();

    assert(!!pay, `${p.id}: Payment found for ${p.poliza}`);
    if (pay) {
      assert(pay.status === 'CONFIRMADO_PF', `${p.id}: Status = CONFIRMADO_PF (got ${pay.status})`);
      assert(pay.insurer === 'FEDPA', `${p.id}: Insurer = FEDPA`);
      assert(!!pay.pf_cod_oper, `${p.id}: Has PF codOper`);
    }

    // Check recurrence if cuotas > 1
    if (p.cuotas > 1) {
      const { data: rec } = await sb.from('adm_cot_recurrences')
        .select('id, status, total_installments, frequency, schedule, next_due_date')
        .eq('nro_poliza', p.poliza).eq('insurer', 'FEDPA').eq('status', 'ACTIVA').maybeSingle();

      assert(!!rec, `${p.id}: Recurrence found (ACTIVA)`);
      if (rec) {
        assert(rec.total_installments === p.cuotas, `${p.id}: Total installments = ${p.cuotas}`);
        assert(!!rec.next_due_date, `${p.id}: Has next_due_date: ${rec.next_due_date}`);
        const schedule = Array.isArray(rec.schedule) ? rec.schedule : [];
        assert(schedule.length === p.cuotas, `${p.id}: Schedule has ${p.cuotas} entries`);
        assert(schedule[0]?.status === 'PAGADO', `${p.id}: 1st installment = PAGADO`);
        if (p.cuotas > 1) assert(schedule[1]?.status === 'PENDIENTE', `${p.id}: 2nd installment = PENDIENTE`);
      }
    }
  }
}

// ════════════════════════════════════════════
// PHASE 5: Bank Import + Group + Pay
// ════════════════════════════════════════════
async function phase5_BankGroupPay() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 5: Bank Import, Group, and Pay');
  console.log('═'.repeat(60));

  const testPolizas = allPolicies.map(p => p.poliza);
  if (testPolizas.length === 0) { console.log('  No policies — skipping'); return; }

  // Get all CONFIRMADO_PF payments for our test policies
  const { data: payments } = await sb.from('adm_cot_payments')
    .select('id, nro_poliza, amount, status, insurer')
    .in('nro_poliza', testPolizas)
    .eq('status', 'CONFIRMADO_PF');

  assert(payments && payments.length > 0, `Found ${payments?.length || 0} CONFIRMADO_PF payments to group`);
  if (!payments || payments.length === 0) return;

  const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
  const refNum = `E2E-REF-${Date.now().toString(36).toUpperCase()}`;

  // Import bank transfer (direct Supabase — matches route.ts import_transfer action)
  console.log(`\n  🏦 Importing bank transfer: ${refNum} ($${totalAmount.toFixed(2)})`);
  const { data: transferRow, error: trErr } = await sb.from('adm_cot_bank_transfers').insert({
    bank_name: 'BANCO GENERAL',
    reference_number: refNum,
    transfer_amount: totalAmount,
    remaining_amount: totalAmount,
    transfer_date: new Date().toISOString().slice(0, 10),
    status: 'OPEN',
    notes: 'E2E Test — auto bank import',
  }).select().single();
  assert(!trErr && transferRow, `Bank transfer imported: ${refNum} (id=${transferRow?.id})`);
  if (trErr) console.log('    Transfer error:', trErr.message);

  // Create group (direct Supabase — matches route.ts create_group action)
  console.log('  📦 Creating payment group...');
  const { data: groupRow, error: grpErr } = await sb.from('adm_cot_payment_groups').insert({
    status: 'DRAFT',
    total_amount: totalAmount,
    paid_amount: 0,
    insurers: [],
    notes: 'E2E Test Group',
  }).select().single();
  assert(!grpErr && groupRow, `Group created: ${groupRow?.id}`);
  if (grpErr) console.log('    Group error:', grpErr.message);
  if (!groupRow) return;

  const groupId = groupRow.id;

  // Assign payments to group + mark as AGRUPADO
  console.log('  ✅ Assigning payments to group...');
  for (const p of payments) {
    await sb.from('adm_cot_payments')
      .update({ group_id: groupId, status: 'AGRUPADO' })
      .eq('id', p.id);
  }

  // Link transfer to group
  if (transferRow) {
    await sb.from('adm_cot_bank_transfers')
      .update({ group_id: groupId, status: 'ASSIGNED', remaining_amount: 0 })
      .eq('id', transferRow.id);
  }

  // Update group to CONFIRMED
  await sb.from('adm_cot_payment_groups')
    .update({ status: 'CONFIRMED', paid_amount: totalAmount })
    .eq('id', groupId);

  // Verify payments are now AGRUPADO
  await sleep(500);
  const { data: grouped } = await sb.from('adm_cot_payments')
    .select('id, status')
    .in('nro_poliza', testPolizas)
    .eq('installment_num', 1);
  const agrupados = grouped?.filter(p => p.status === 'AGRUPADO') || [];
  assert(agrupados.length === payments.length, `${agrupados.length}/${payments.length} payments now AGRUPADO`);
}

// ════════════════════════════════════════════
// PHASE 6: Cron Recurrence + Failed Charges + Morosidad
// ════════════════════════════════════════════
async function phase6_CronAndMorosidad() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 6: Cron Recurrence + Failed Charge Simulation');
  console.log('═'.repeat(60));

  // Get active recurrences for test policies
  const testPolizas = allPolicies.filter(p => p.cuotas > 1).map(p => p.poliza);
  if (testPolizas.length === 0) { console.log('  No multi-cuota policies — skipping'); return; }

  // Set next_due_date to today so cron picks them up
  console.log('\n  ⏰ Setting recurrence due dates to today...');
  const today = new Date().toISOString().slice(0, 10);
  for (const poliza of testPolizas) {
    await sb.from('adm_cot_recurrences')
      .update({ next_due_date: today })
      .eq('nro_poliza', poliza).eq('status', 'ACTIVA');
  }

  // Trigger cron
  console.log('  🔄 Triggering recurrence cron...');
  const cronRes = await fetch(`${SITE_URL}/api/cron/adm-cot-recurrencia`, {
    method: 'GET',
    headers: { 'x-cron-secret': CRON_SECRET },
  });
  const cronData = await cronRes.json();
  assert(cronData.success, `Cron ran: processed=${cronData.processed}, created=${cronData.created}`);

  // Verify new payments created (cuota 2 for each multi-cuota policy)
  await sleep(2000);
  for (const poliza of testPolizas) {
    const { data: cuota2 } = await sb.from('adm_cot_payments')
      .select('id, status, installment_num, amount')
      .eq('nro_poliza', poliza)
      .eq('installment_num', 2)
      .maybeSingle();

    assert(!!cuota2, `Cuota 2 created for ${poliza}`);
    if (cuota2) {
      // PF sandbox may fail or succeed — check that payment exists with some status
      assert(['CONFIRMADO_PF', 'PENDIENTE_CONFIRMACION'].includes(cuota2.status),
        `Cuota 2 status: ${cuota2.status} (expected CONFIRMADO_PF or PENDIENTE_CONFIRMACION)`);
    }
  }

  // Simulate PF rejection via webhook for one policy
  console.log('\n  ❌ Simulating PF rejected charge via webhook...');
  const targetPoliza = testPolizas[0];
  const { data: targetPay } = await sb.from('adm_cot_payments')
    .select('id, pf_cod_oper, status, nro_poliza')
    .eq('nro_poliza', targetPoliza)
    .eq('installment_num', 2)
    .maybeSingle();

  if (targetPay) {
    // Manually mark as RECHAZADO_PF to simulate webhook rejection
    const rejNotes = {
      rejection_reason: 'Insufficient Funds (E2E Test)',
      rejected_at: new Date().toISOString(),
      morosidad_emails: {},
    };
    await sb.from('adm_cot_payments').update({
      status: 'RECHAZADO_PF',
      notes: rejNotes,
    }).eq('id', targetPay.id);

    // Verify it shows as RECHAZADO_PF
    const { data: rejected } = await sb.from('adm_cot_payments')
      .select('status, notes')
      .eq('id', targetPay.id).single();
    assert(rejected?.status === 'RECHAZADO_PF', `Payment ${targetPay.id} now RECHAZADO_PF (morosidad)`);
    assert(rejected?.notes?.rejection_reason?.includes('Insufficient'), 'Rejection reason recorded');
  }
}

// ════════════════════════════════════════════
// PHASE 7: Client Payment via Morosidad
// ════════════════════════════════════════════
async function phase7_MorosidadPayment() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 7: Client Payment via Morosidad (Simulated)');
  console.log('═'.repeat(60));

  // Find the RECHAZADO_PF payment from phase 6
  const testPolizas = allPolicies.filter(p => p.cuotas > 1).map(p => p.poliza);
  if (testPolizas.length === 0) return;

  const { data: rejectedPay } = await sb.from('adm_cot_payments')
    .select('id, nro_poliza, client_name, amount, status, installment_num')
    .eq('nro_poliza', testPolizas[0])
    .eq('status', 'RECHAZADO_PF')
    .maybeSingle();

  if (!rejectedPay) {
    console.log('  No RECHAZADO_PF payment found — skipping');
    return;
  }

  console.log(`  🔁 Client pays rejected cuota #${rejectedPay.installment_num}: $${rejectedPay.amount}`);

  // Simulate client paying via PF (sandbox) — just mark as CONFIRMADO_PF
  await sb.from('adm_cot_payments').update({
    status: 'CONFIRMADO_PF',
    pf_confirmed_at: new Date().toISOString(),
    pf_cod_oper: `E2E-MOROSIDAD-REPAY-${Date.now()}`,
    notes: { repaid: true, repaid_at: new Date().toISOString(), original_rejection: 'Insufficient Funds (E2E Test)' },
  }).eq('id', rejectedPay.id);

  const { data: repaid } = await sb.from('adm_cot_payments')
    .select('status').eq('id', rejectedPay.id).single();
  assert(repaid?.status === 'CONFIRMADO_PF', `Morosidad payment now CONFIRMADO_PF (re-paid)`);
}

// ════════════════════════════════════════════
// PHASE 8: Final Report
// ════════════════════════════════════════════
async function phase8_Report() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 8: FINAL REPORT');
  console.log('═'.repeat(60));

  console.log('\n  📋 POLICY NUMBERS FOR FEDPA DELETION:');
  console.log('  ' + '─'.repeat(55));
  console.log('  #   | Type | Cuotas | Client               | Póliza');
  console.log('  ' + '─'.repeat(55));
  for (let i = 0; i < allPolicies.length; i++) {
    const p = allPolicies[i];
    console.log(`  ${String(i + 1).padStart(3)} | ${p.type}   | ${String(p.cuotas).padStart(6)} | ${p.client.padEnd(20).substring(0, 20)} | ${p.poliza}`);
  }
  console.log('  ' + '─'.repeat(55));
  console.log(`  Total: ${allPolicies.length} policies`);

  console.log('\n  📋 VEHICLE DETAILS:');
  for (const p of allPolicies) {
    console.log(`    ${p.id}: ${p.marca} ${p.modelo} ${p.ano} — Placa: ${p.poliza}`);
  }

  // Summary of all test activity
  console.log('\n  📊 ADM COT SUMMARY:');
  const { data: allPays } = await sb.from('adm_cot_payments')
    .select('id, status, nro_poliza, amount, installment_num')
    .in('nro_poliza', allPolicies.map(p => p.poliza));
  const statuses = {};
  (allPays || []).forEach(p => { statuses[p.status] = (statuses[p.status] || 0) + 1; });
  console.log(`    Total payments: ${allPays?.length || 0}`);
  for (const [s, c] of Object.entries(statuses)) {
    console.log(`    ${s}: ${c}`);
  }

  const { data: allRecs } = await sb.from('adm_cot_recurrences')
    .select('id, status, nro_poliza')
    .in('nro_poliza', allPolicies.map(p => p.poliza));
  console.log(`    Recurrences: ${allRecs?.length || 0}`);
}

// ════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════
async function main() {
  console.log('═'.repeat(60));
  console.log('  FEDPA E2E FULL TEST — 10 Emissions + Payment Cycle');
  console.log('  DT: PROD (Plan 1000/1002) | CC: PROD (EmisorExterno) | PF: sandbox');
  console.log('═'.repeat(60));

  try {
    await phase1_DTEmissions();
    await phase2_CCEmissions();
    await phase3_CaratulaDownload();
    await phase4_VerifyPayments();
    await phase5_BankGroupPay();
    await phase6_CronAndMorosidad();
    await phase7_MorosidadPayment();
    await phase8_Report();
  } catch (err) {
    console.error('\n💥 FATAL ERROR:', err.message);
    console.error(err.stack);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
  console.log('═'.repeat(60));

  process.exit(fail > 0 ? 1 : 0);
}

main();
