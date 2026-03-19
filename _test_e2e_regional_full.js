/**
 * ══════════════════════════════════════════════════════════════════
 * E2E FULL TEST — La Regional de Seguros (RC + CC)
 * ══════════════════════════════════════════════════════════════════
 *
 * Tests the FULL emission flow as the UI does:
 *   RC (DT): /api/regional/auto/emit-rc  (Plan 30=Básico/$145, Plan 31=Plus/$162)
 *   CC:      /api/regional/auto/quote-cc → /api/regional/auto/emit-cc
 *   Carátula: /api/regional/auto/print
 *   ADM COT: payments, recurrences, bank import, grouping, cron, morosidad
 *
 * Environment: development (desa.laregionaldeseguros.com)
 *
 * DB schema (adm_cot_payments):
 *   client_name, cedula, nro_poliza, amount, insurer, ramo, status,
 *   group_id, payment_source, payment_ref, payment_date, is_recurring,
 *   recurrence_id, installment_num, pf_cod_oper, due_date, notes
 *
 * DB schema (adm_cot_recurrences):
 *   nro_poliza, client_name, cedula, insurer, total_installments,
 *   frequency, installment_amount, status, start_date, end_date,
 *   next_due_date, schedule, pf_cod_oper
 *
 * DB schema (adm_cot_bank_transfers):
 *   bank_name, reference_number, transfer_amount, remaining_amount,
 *   transfer_date, status, notes, metadata
 *
 * DB schema (adm_cot_payment_groups):
 *   bank_reference, total_amount, paid_amount, status, insurers,
 *   payment_date, notes, total_selected_amount
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SITE = 'http://localhost:3000';
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let passed = 0;
let failed = 0;
const allPolicies = []; // { id, type, poliza, cuotas, client, numcot, prima }

function ok(msg) { passed++; console.log(`  ✅ ${msg}`); }
function fail(msg) { failed++; console.log(`  ❌ FAIL: ${msg}`); }
function check(cond, msg) { cond ? ok(msg) : fail(msg); }

function calcAge(dobStr) {
  const [y, m, d] = dobStr.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

// Unique suffix per run to avoid "automóvil ya asociado a póliza"
const RUN = Date.now().toString(36).toUpperCase().slice(-5);

// ════════════════════════════════════════════
// RC (DT) plan codes
const RC_BASIC_PLAN = '30';
const RC_BASIC_PRIMA = 145;
const RC_PREMIUM_PLAN = '31';
const RC_PREMIUM_PRIMA = 162;

// ════════════════════════════════════════════
// Test Data — 5 RC (DT) + 5 CC
// Vehicle codes: IS codes resolved to Regional via name-matching
// Plates & VINs unique per run to avoid "ya asociado a póliza"
// ════════════════════════════════════════════
const TEST_CEDULA_BASE = '8-999-';

const RC_TESTS = [
  { id: 'RC1', cuotas: 1, planType: 'basic',   isMarca: 156, isModelo: 1434, marca: 'TOYOTA',  modelo: 'COROLLA',  ano: 2022, color: 'BLANCO', primerNombre: 'CARLOS', primerApellido: 'MARTINEZ',  sexo: 'M', fechaNac: '1990-06-15' },
  { id: 'RC2', cuotas: 1, planType: 'premium',  isMarca: 156, isModelo: 1434, marca: 'TOYOTA',  modelo: 'FORTUNER', ano: 2023, color: 'NEGRO',  primerNombre: 'MARIA',  primerApellido: 'RODRIGUEZ', sexo: 'F', fechaNac: '1985-01-01' },
  { id: 'RC3', cuotas: 1, planType: 'basic',   isMarca: 156, isModelo: 1434, marca: 'TOYOTA',  modelo: 'RAV4',     ano: 2021, color: 'GRIS',   primerNombre: 'JUAN',   primerApellido: 'PEREZ',     sexo: 'M', fechaNac: '1988-11-10' },
  { id: 'RC4', cuotas: 1, planType: 'premium',  isMarca: 156, isModelo: 1434, marca: 'TOYOTA',  modelo: 'HILUX',    ano: 2024, color: 'ROJO',   primerNombre: 'ANA',    primerApellido: 'GONZALEZ',  sexo: 'F', fechaNac: '1992-09-05' },
  { id: 'RC5', cuotas: 1, planType: 'basic',   isMarca: 156, isModelo: 1434, marca: 'TOYOTA',  modelo: 'YARIS',    ano: 2020, color: 'AZUL',   primerNombre: 'PEDRO',  primerApellido: 'SANCHEZ',   sexo: 'M', fechaNac: '1995-01-18' },
];

const CC_TESTS = [
  { id: 'CC1', cuotas: 1, isMarca: 156, isModelo: 1434, marca: 'TOYOTA', modelo: 'FORTUNER', ano: 2023, color: 'BLANCO', primerNombre: 'LUIS',    primerApellido: 'HERRERA',  sexo: 'M', fechaNac: '1987-04-20', valorVeh: 25000, endoso: '1' },
  { id: 'CC2', cuotas: 2, isMarca: 156, isModelo: 1434, marca: 'TOYOTA', modelo: 'COROLLA',  ano: 2022, color: 'GRIS',   primerNombre: 'CARMEN',  primerApellido: 'DIAZ',     sexo: 'F', fechaNac: '1991-07-12', valorVeh: 20000, endoso: '1' },
  { id: 'CC3', cuotas: 3, isMarca: 156, isModelo: 1434, marca: 'TOYOTA', modelo: 'RAV4',     ano: 2021, color: 'NEGRO',  primerNombre: 'ROBERTO', primerApellido: 'VARGAS',   sexo: 'M', fechaNac: '1983-12-30', valorVeh: 22000, endoso: '2' },
  { id: 'CC4', cuotas: 4, isMarca: 156, isModelo: 1434, marca: 'TOYOTA', modelo: 'HILUX',    ano: 2024, color: 'PLATA',  primerNombre: 'SOFIA',   primerApellido: 'CASTILLO', sexo: 'F', fechaNac: '1996-02-08', valorVeh: 30000, endoso: '1' },
  { id: 'CC5', cuotas: 2, isMarca: 156, isModelo: 1434, marca: 'TOYOTA', modelo: 'YARIS',    ano: 2020, color: 'VERDE',  primerNombre: 'MIGUEL',  primerApellido: 'TORRES',   sexo: 'M', fechaNac: '1989-08-25', valorVeh: 15000, endoso: '1' },
];

// ════════════════════════════════════════════
// PHASE 1: RC (DT) Emissions
// ════════════════════════════════════════════
async function phase1_RCEmissions() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 1: RC Emissions (Daños a Terceros) — 5 policies');
  console.log(`  Run ID: ${RUN}`);
  console.log('═'.repeat(60));

  for (const t of RC_TESTS) {
    const plan = t.planType === 'basic' ? RC_BASIC_PLAN : RC_PREMIUM_PLAN;
    const prima = t.planType === 'basic' ? RC_BASIC_PRIMA : RC_PREMIUM_PRIMA;
    const edad = calcAge(t.fechaNac);
    const placa = `${t.id}${RUN}`;
    const vin = `VIN${t.id}${RUN}00000`;
    const motor = `MOT${t.id}${RUN}`;
    console.log(`\n── ${t.id}: ${t.marca} ${t.modelo} ${t.ano} (${t.planType}, $${prima}, edad=${edad}) ──`);

    const asiento = 10000 + parseInt(t.id.replace('RC', ''));
    const cedula = `${TEST_CEDULA_BASE}${asiento}`;

    try {
      const res = await fetch(`${SITE}/api/regional/auto/emit-rc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          nombre: t.primerNombre, apellido: t.primerApellido,
          fechaNacimiento: t.fechaNac, edad, sexo: t.sexo, edocivil: 'S',
          telefono: '2900000', celular: String(62900000 + parseInt(t.id.replace('RC', ''))),
          email: 'e2e@lideresenseguros.com',
          codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1,
          dirhab: 'Ciudad de Panama',
          tppersona: 'N', tpodoc: 'C',
          prov: 8, tomo: 999, asiento, dv: 1,
          codmarca: t.isMarca, codmodelo: t.isModelo, anio: t.ano,
          marca: t.marca, modelo: t.modelo,
          numplaca: placa,
          serialcarroceria: vin,
          serialmotor: motor,
          color: t.color,
        }),
      });
      const data = await res.json();

      if (data.success && data.poliza) {
        ok(`${t.id}: Emitted! Poliza=${data.poliza}`);
        allPolicies.push({
          id: t.id, type: 'RC', poliza: data.poliza, cuotas: t.cuotas,
          client: `${t.primerNombre} ${t.primerApellido}`,
          prima, numcot: data.numcot, insurer: 'REGIONAL',
        });

        // Create ADM COT payment (correct column names)
        const { error: payErr } = await sb.from('adm_cot_payments').insert({
          nro_poliza: data.poliza,
          insurer: 'REGIONAL',
          client_name: `${t.primerNombre} ${t.primerApellido}`,
          cedula,
          amount: prima,
          installment_num: 1,
          status: 'CONFIRMADO_PF',
          ramo: 'AUTO',
          payment_source: 'SANDBOX_PF',
          payment_date: new Date().toISOString().split('T')[0],
          is_recurring: false,
          pf_cod_oper: `E2E-REGRC-${t.id}-${Date.now().toString(36)}`,
          pf_confirmed_at: new Date().toISOString(),
          notes: { e2e: true, plan, test: t.id, run: RUN },
        });
        if (payErr) {
          fail(`${t.id}: ADM COT payment error — ${payErr.message}`);
        } else {
          ok(`${t.id}: ADM COT payment created`);
        }
      } else {
        fail(`${t.id}: Emission failed — ${(data.error || JSON.stringify(data)).substring(0, 300)}`);
      }
    } catch (e) {
      fail(`${t.id}: Exception — ${e.message}`);
    }
  }
}

// ════════════════════════════════════════════
// PHASE 2: CC Emissions (Quote → Emit)
// ════════════════════════════════════════════
async function phase2_CCEmissions() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 2: CC Emissions (Cobertura Completa) — 5 policies');
  console.log('═'.repeat(60));

  for (const t of CC_TESTS) {
    const edad = calcAge(t.fechaNac);
    const placa = `${t.id}${RUN}`;
    const vin = `VIN${t.id}${RUN}00000`;
    const motor = `MOT${t.id}${RUN}`;
    console.log(`\n── ${t.id}: ${t.marca} ${t.modelo} ${t.ano} (${t.cuotas} cuota${t.cuotas > 1 ? 's' : ''}, $${t.valorVeh}, edad=${edad}) ──`);

    const asiento = 20000 + parseInt(t.id.replace('CC', ''));
    const cedula = `${TEST_CEDULA_BASE}${asiento}`;

    // Step 1: Get CC cotización (numcot)
    console.log('  📊 Getting CC quote...');
    let numcot = null;
    let primaTotal = null;
    try {
      const qRes = await fetch(`${SITE}/api/regional/auto/quote-cc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: t.primerNombre, apellido: t.primerApellido,
          edad, sexo: t.sexo, edocivil: 'S',
          tppersona: 'N', tpodoc: 'C',
          prov: 8, tomo: 999, asiento, dv: 1,
          telefono: '2900000', celular: String(62900000 + parseInt(t.id.replace('CC', ''))),
          email: 'e2e@lideresenseguros.com',
          vehnuevo: 'N',
          codMarca: t.isMarca, codModelo: t.isModelo,
          marca: t.marca, modelo: t.modelo,
          anio: t.ano, valorVeh: t.valorVeh, numPuestos: 5,
          endoso: t.endoso,
        }),
      });
      const qData = await qRes.json();
      if (qData.success && qData.numcot) {
        numcot = qData.numcot;
        // Extract prima from opciones array (opcion 1 is default)
        if (qData.opciones && Array.isArray(qData.opciones) && qData.opciones.length > 0) {
          primaTotal = qData.opciones[0].primaTotal || 0;
        } else {
          primaTotal = qData.primaTotal || qData.primaAnual || qData.prima || 0;
        }
        ok(`${t.id}: Quote OK — numcot=${numcot}, prima=$${primaTotal}, opciones=${qData.opciones?.length || 0}`);
      } else {
        fail(`${t.id}: Quote failed — ${(qData.error || qData.message || JSON.stringify(qData)).substring(0, 300)}`);
        continue;
      }
    } catch (e) {
      fail(`${t.id}: Quote exception — ${e.message}`);
      continue;
    }

    // Step 2: Emit CC policy
    console.log('  🏗️ Emitting CC policy...');
    try {
      const eRes = await fetch(`${SITE}/api/regional/auto/emit-cc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numcot,
          codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1,
          dirhab: 'Ciudad de Panama',
          ocupacion: 1, ingresoAnual: 1, paisTributa: 507, pep: 'N',
          vehnuevo: 'N',
          numplaca: placa,
          serialcarroceria: vin,
          serialmotor: motor,
          color: t.color,
          usoveh: 'P', peso: 'L',
          acreedor: '81',
          cuotas: t.cuotas,
          opcionPrima: 1,
        }),
      });
      const eData = await eRes.json();

      if (eData.success && eData.poliza) {
        ok(`${t.id}: Emitted! Poliza=${eData.poliza}`);
        allPolicies.push({
          id: t.id, type: 'CC', poliza: eData.poliza, cuotas: t.cuotas,
          client: `${t.primerNombre} ${t.primerApellido}`,
          prima: primaTotal, numcot, insurer: 'REGIONAL',
        });

        // Create ADM COT payment (correct column names)
        const installmentAmount = t.cuotas > 1 ? +(primaTotal / t.cuotas).toFixed(2) : primaTotal;
        const { error: payErr } = await sb.from('adm_cot_payments').insert({
          nro_poliza: eData.poliza,
          insurer: 'REGIONAL',
          client_name: `${t.primerNombre} ${t.primerApellido}`,
          cedula,
          amount: installmentAmount,
          installment_num: 1,
          status: 'CONFIRMADO_PF',
          ramo: 'AUTO',
          payment_source: 'SANDBOX_PF',
          payment_date: new Date().toISOString().split('T')[0],
          is_recurring: t.cuotas > 1,
          pf_cod_oper: `E2E-REGCC-${t.id}-${Date.now().toString(36)}`,
          pf_confirmed_at: new Date().toISOString(),
          notes: { e2e: true, numcot, test: t.id, run: RUN },
        });
        if (payErr) {
          fail(`${t.id}: ADM COT payment error — ${payErr.message}`);
        } else {
          ok(`${t.id}: ADM COT payment created`);
        }

        // Create recurrence if multi-cuota (correct column names + schedule.num)
        if (t.cuotas > 1) {
          // DB only allows MENSUAL and SEMESTRAL
          const freqMap = { 2: 'SEMESTRAL', 3: 'MENSUAL', 4: 'MENSUAL' };
          const freqMonthsMap = { 2: 6, 3: 4, 4: 3 };
          const freqMonths = freqMonthsMap[t.cuotas] || 6;
          const startDate = new Date();
          const endDate = new Date(); endDate.setFullYear(endDate.getFullYear() + 1);
          const nextDue = new Date(); nextDue.setMonth(nextDue.getMonth() + freqMonths);

          // Schedule uses { num, due_date, amount, status } per cron expectations
          const schedule = Array.from({ length: t.cuotas }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() + (i * freqMonths));
            return {
              num: i + 1,
              due_date: d.toISOString().split('T')[0],
              amount: installmentAmount,
              status: i === 0 ? 'PAGADO' : 'PENDIENTE',
            };
          });

          const { error: recErr } = await sb.from('adm_cot_recurrences').insert({
            nro_poliza: eData.poliza,
            client_name: `${t.primerNombre} ${t.primerApellido}`,
            cedula,
            insurer: 'REGIONAL',
            total_installments: t.cuotas,
            installment_amount: installmentAmount,
            frequency: freqMap[t.cuotas] || 'SEMESTRAL',
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            next_due_date: nextDue.toISOString().split('T')[0],
            status: 'ACTIVA',
            schedule,
          });
          if (recErr) {
            fail(`${t.id}: Recurrence error — ${recErr.message}`);
          } else {
            ok(`${t.id}: Recurrence created (${t.cuotas} cuotas, ${freqMap[t.cuotas]})`);
          }
        }
      } else {
        fail(`${t.id}: CC emission failed — ${(eData.error || JSON.stringify(eData)).substring(0, 300)}`);
      }
    } catch (e) {
      fail(`${t.id}: CC emit exception — ${e.message}`);
    }
  }
}

// ════════════════════════════════════════════
// PHASE 3: Carátula PDF Download
// ════════════════════════════════════════════
async function phase3_Caratulas() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 3: Carátula PDF Download');
  console.log('═'.repeat(60));

  if (allPolicies.length === 0) {
    console.log('  No policies emitted — skipping');
    return;
  }

  const fs = require('fs');
  if (!fs.existsSync('_e2e_caratulas_regional')) fs.mkdirSync('_e2e_caratulas_regional');

  for (const p of allPolicies) {
    console.log(`\n── ${p.id}: ${p.poliza} ──`);
    try {
      const res = await fetch(`${SITE}/api/regional/auto/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poliza: p.poliza }),
      });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('pdf')) {
        const buf = Buffer.from(await res.arrayBuffer());
        ok(`${p.id}: Carátula PDF downloaded (${buf.length} bytes)`);
        const fname = `_e2e_caratulas_regional/caratula_${p.id}_${p.poliza.replace(/[\/\-]/g, '_')}.pdf`;
        fs.writeFileSync(fname, buf);
        console.log(`    📥 Saved: ${fname}`);
      } else {
        const body = await res.text();
        let data = {};
        try { data = JSON.parse(body); } catch {}
        fail(`${p.id}: No PDF (ct=${ct}) — ${data.error || data.message || body.substring(0, 200)}`);
      }
    } catch (e) {
      fail(`${p.id}: Print exception — ${e.message}`);
    }
  }
}

// ════════════════════════════════════════════
// PHASE 4: Verify Payments + Recurrences
// ════════════════════════════════════════════
async function phase4_VerifyPayments() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 4: Verify ADM COT Payments + Recurrences');
  console.log('═'.repeat(60));

  if (allPolicies.length === 0) { console.log('  No policies — skipping'); return; }

  for (const p of allPolicies) {
    const { data: pay } = await sb.from('adm_cot_payments')
      .select('*').eq('nro_poliza', p.poliza).eq('installment_num', 1).single();

    if (pay) {
      ok(`${p.id}: Payment found for ${p.poliza}`);
      check(pay.status === 'CONFIRMADO_PF', `${p.id}: Status = CONFIRMADO_PF (got ${pay.status})`);
      check(pay.insurer === 'REGIONAL', `${p.id}: Insurer = REGIONAL`);
      check(!!pay.pf_cod_oper, `${p.id}: Has PF codOper`);
    } else {
      fail(`${p.id}: Payment NOT found for ${p.poliza}`);
    }

    if (p.cuotas > 1) {
      const { data: rec } = await sb.from('adm_cot_recurrences')
        .select('*').eq('nro_poliza', p.poliza).single();
      if (rec) {
        check(rec.status === 'ACTIVA', `${p.id}: Recurrence status = ACTIVA (got ${rec.status})`);
        check(rec.total_installments === p.cuotas, `${p.id}: Total installments = ${p.cuotas} (got ${rec.total_installments})`);
        check(!!rec.next_due_date, `${p.id}: Has next_due_date: ${rec.next_due_date}`);
        if (rec.schedule) {
          check(rec.schedule.length === p.cuotas, `${p.id}: Schedule has ${p.cuotas} entries`);
          check(rec.schedule[0]?.status === 'PAGADO', `${p.id}: 1st installment = PAGADO`);
          check(rec.schedule[1]?.status === 'PENDIENTE', `${p.id}: 2nd installment = PENDIENTE`);
        }
      } else {
        fail(`${p.id}: Recurrence NOT found for ${p.poliza}`);
      }
    }
  }
}

// ════════════════════════════════════════════
// PHASE 5: Bank Import, Group, Pay
// ════════════════════════════════════════════
async function phase5_BankGroupPay() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 5: Bank Import, Group, and Pay');
  console.log('═'.repeat(60));

  if (allPolicies.length === 0) { console.log('  No policies — skipping'); return; }

  const { data: confPays, error: confErr } = await sb.from('adm_cot_payments')
    .select('id, nro_poliza, amount')
    .in('nro_poliza', allPolicies.map(p => p.poliza))
    .eq('status', 'CONFIRMADO_PF');

  if (confErr) { fail(`Query payments: ${confErr.message}`); return; }
  check(confPays && confPays.length > 0, `Found ${confPays?.length || 0} CONFIRMADO_PF payments to group`);
  if (!confPays || confPays.length === 0) return;

  const totalAmount = confPays.reduce((s, p) => s + (p.amount || 0), 0);
  const bankRef = `E2E-REG-${RUN}`;

  console.log(`\n  🏦 Importing bank transfer: ${bankRef} ($${totalAmount.toFixed(2)})`);
  const { data: bankRow, error: bankErr } = await sb.from('adm_cot_bank_transfers').insert({
    reference_number: bankRef,
    transfer_amount: totalAmount,
    remaining_amount: totalAmount,
    transfer_date: new Date().toISOString().split('T')[0],
    bank_name: 'BANCO_E2E',
    status: 'OPEN',
    notes: { e2e: true, test: 'regional', run: RUN },
  }).select('id').single();

  if (bankErr) {
    fail(`Bank transfer error: ${bankErr.message}`);
  } else {
    ok(`Bank transfer imported: ${bankRef} (id=${bankRow?.id})`);
  }

  console.log('  📦 Creating payment group...');
  const { data: group, error: grpErr } = await sb.from('adm_cot_payment_groups').insert({
    bank_reference: bankRef,
    status: 'PENDIENTE',
    total_amount: totalAmount,
    paid_amount: 0,
    insurers: ['REGIONAL'],
    payment_date: new Date().toISOString().split('T')[0],
    notes: { e2e: true, run: RUN },
  }).select('id').single();

  if (grpErr) {
    fail(`Group error: ${grpErr.message}`);
  } else {
    ok(`Group created: ${group?.id}`);
  }

  console.log('  ✅ Assigning payments to group...');
  for (const pay of confPays) {
    await sb.from('adm_cot_payments')
      .update({ status: 'AGRUPADO', group_id: group?.id })
      .eq('id', pay.id);
  }

  const { data: grouped } = await sb.from('adm_cot_payments')
    .select('id').eq('group_id', group?.id).eq('status', 'AGRUPADO');
  check(grouped?.length === confPays.length, `${grouped?.length}/${confPays.length} payments now AGRUPADO`);
}

// ════════════════════════════════════════════
// PHASE 6: Cron Recurrence + Morosidad
// ════════════════════════════════════════════
async function phase6_CronAndMorosidad() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 6: Cron Recurrence + Failed Charge Simulation');
  console.log('═'.repeat(60));

  const multiPolicies = allPolicies.filter(p => p.cuotas > 1);
  if (multiPolicies.length === 0) {
    console.log('  No multi-cuota policies — skipping cron test');
    return;
  }

  // First un-group multi-cuota payments so they remain in system
  // Set recurrence due dates to today so cron picks them up
  console.log(`\n  ⏰ Setting ${multiPolicies.length} recurrence due dates to today...`);
  const today = new Date().toISOString().split('T')[0];
  for (const p of multiPolicies) {
    await sb.from('adm_cot_recurrences')
      .update({ next_due_date: today })
      .eq('nro_poliza', p.poliza);
  }

  // Cron endpoint is GET, not POST
  const cronSecret = process.env.ADM_COT_CRON_SECRET || process.env.CRON_SECRET;
  console.log('  🔄 Triggering recurrence cron (GET)...');
  try {
    const cronRes = await fetch(`${SITE}/api/cron/adm-cot-recurrencia`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const cronText = await cronRes.text();
    let cronData = {};
    try { cronData = JSON.parse(cronText); } catch { console.log(`    Raw cron response: ${cronText.substring(0, 300)}`); }
    console.log(`    Cron status=${cronRes.status}: processed=${cronData.processed || 0}, created=${cronData.created || 0}, charged=${cronData.charged || 0}, errors=${JSON.stringify(cronData.errors || [])}`);
    ok(`Cron ran: processed=${cronData.processed || 0}, created=${cronData.created || 0}`);

    // Verify installment 2 created for multi-cuota
    for (const p of multiPolicies) {
      const { data: c2 } = await sb.from('adm_cot_payments')
        .select('*').eq('nro_poliza', p.poliza).eq('installment_num', 2).maybeSingle();
      if (c2) {
        ok(`Installment 2 created for ${p.poliza}`);
        check(['CONFIRMADO_PF', 'PENDIENTE_CONFIRMACION'].includes(c2.status),
          `Installment 2 status: ${c2.status}`);
      } else {
        fail(`Installment 2 NOT created for ${p.poliza}`);
      }
    }
  } catch (e) {
    fail(`Cron exception: ${e.message}`);
  }

  // Simulate PF rejection → morosidad
  console.log('\n  ❌ Simulating PF rejected charge...');
  const firstMulti = multiPolicies[0];
  if (firstMulti) {
    const { data: c2pay } = await sb.from('adm_cot_payments')
      .select('id').eq('nro_poliza', firstMulti.poliza).eq('installment_num', 2).maybeSingle();
    if (c2pay) {
      await sb.from('adm_cot_payments').update({
        status: 'RECHAZADO_PF',
        notes: { rejected_reason: 'E2E test rejection', rejected_at: new Date().toISOString() },
      }).eq('id', c2pay.id);
      const { data: rej } = await sb.from('adm_cot_payments').select('status, notes').eq('id', c2pay.id).single();
      ok(`Payment ${c2pay.id} now ${rej?.status} (morosidad)`);
      check(!!rej?.notes?.rejected_reason, 'Rejection reason recorded');
    } else {
      console.log('  ⚠️ No installment 2 payment found to reject');
    }
  }
}

// ════════════════════════════════════════════
// PHASE 7: Morosidad Re-payment
// ════════════════════════════════════════════
async function phase7_MorosidadPayment() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 7: Client Payment via Morosidad (Simulated)');
  console.log('═'.repeat(60));

  if (allPolicies.length === 0) { console.log('  No policies — skipping'); return; }

  const { data: rejPay } = await sb.from('adm_cot_payments')
    .select('*')
    .in('nro_poliza', allPolicies.map(p => p.poliza))
    .eq('status', 'RECHAZADO_PF')
    .limit(1).maybeSingle();

  if (!rejPay) {
    console.log('  No RECHAZADO_PF payments found — skipping');
    return;
  }

  console.log(`  🔁 Client pays rejected installment #${rejPay.installment_num}: $${rejPay.amount}`);
  await sb.from('adm_cot_payments').update({
    status: 'CONFIRMADO_PF',
    pf_cod_oper: `E2E-REGMORO-${Date.now().toString(36)}`,
    pf_confirmed_at: new Date().toISOString(),
    notes: { ...rejPay.notes, repaid_at: new Date().toISOString() },
  }).eq('id', rejPay.id);

  const { data: repaid } = await sb.from('adm_cot_payments').select('status').eq('id', rejPay.id).single();
  check(repaid?.status === 'CONFIRMADO_PF', `Morosidad payment now CONFIRMADO_PF (re-paid)`);
}

// ════════════════════════════════════════════
// PHASE 8: FINAL REPORT
// ════════════════════════════════════════════
async function phase8_Report() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 8: FINAL REPORT');
  console.log('═'.repeat(60));

  console.log(`\n  📋 Run ID: ${RUN}`);
  console.log('\n  📋 POLICY NUMBERS FOR REGIONAL DELETION:');
  console.log('  ' + '─'.repeat(65));
  console.log('  #   | Type | Cuotas | Prima    | Client               | Poliza');
  console.log('  ' + '─'.repeat(65));
  allPolicies.forEach((p, i) => {
    console.log(`  ${String(i + 1).padStart(3)} | ${p.type.padEnd(4)} | ${String(p.cuotas).padStart(6)} | $${String(p.prima || '?').padStart(6)} | ${p.client.padEnd(20)} | ${p.poliza}`);
  });
  console.log('  ' + '─'.repeat(65));
  console.log(`  Total: ${allPolicies.length} policies`);

  console.log('\n  📋 VEHICLE DETAILS:');
  const allTests = [...RC_TESTS, ...CC_TESTS];
  allPolicies.forEach(p => {
    const t = allTests.find(x => x.id === p.id);
    if (t) console.log(`    ${p.id}: ${t.marca} ${t.modelo} ${t.ano} — Poliza: ${p.poliza}`);
  });

  // Summary counts
  if (allPolicies.length > 0) {
    const { data: allPays } = await sb.from('adm_cot_payments')
      .select('status')
      .in('nro_poliza', allPolicies.map(p => p.poliza));
    const { data: allRecs } = await sb.from('adm_cot_recurrences')
      .select('status')
      .in('nro_poliza', allPolicies.map(p => p.poliza));

    console.log('\n  📊 ADM COT SUMMARY:');
    console.log(`    Total payments: ${allPays?.length || 0}`);
    const statusCounts = {};
    allPays?.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });
    Object.entries(statusCounts).forEach(([s, c]) => console.log(`      ${s}: ${c}`));
    console.log(`    Recurrences: ${allRecs?.length || 0}`);
    allRecs?.forEach(r => console.log(`      ${r.status}`));
  }
}

// ════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════
async function main() {
  console.log('═'.repeat(60));
  console.log('  REGIONAL E2E FULL TEST — RC + CC Emissions + Payment Cycle');
  console.log(`  RC: DEV (Plan 30/31) | CC: DEV (quote→emit) | Run: ${RUN}`);
  console.log('═'.repeat(60));

  try {
    await phase1_RCEmissions();
    await phase2_CCEmissions();
    await phase3_Caratulas();
    await phase4_VerifyPayments();
    await phase5_BankGroupPay();
    await phase6_CronAndMorosidad();
    await phase7_MorosidadPayment();
    await phase8_Report();
  } catch (e) {
    console.error('\n🚨 FATAL ERROR:', e);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main();
