/**
 * SMOKE TEST — Emission Idempotency Guard E2E
 *
 * Tests the full flow:
 * 1. PF charge succeeds → emission fails → auto-report → ops_case created with full expediente
 * 2. Same cotización re-attempt → BLOCKED by charge-guard (barrier 1 via adm_cot_payments)
 * 3. Fresh start same placa → BLOCKED by charge-guard (barrier 2 via ops_cases)
 * 4. Same cedula+insurer within 24h → BLOCKED by charge-guard (barrier 3)
 * 5. adm_cot_payments has EMISION_FALLIDA record with correct data
 * 6. ops_case has full details: client, vehicle, expediente, payment data
 *
 * Run: node _test_smoke_emission_guard.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = 'http://localhost:3000'; // Always test against local dev server

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
let pass = 0, fail = 0;
const cleanup = [];

function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ PASS: ${msg}`); }
  else { fail++; console.log(`  ❌ FAIL: ${msg}`); }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  SMOKE TEST: Emission Idempotency Guard E2E');
  console.log('═══════════════════════════════════════════════════\n');

  const today = new Date().toISOString().slice(0, 10);

  // ── Test data ──
  const clientData = {
    primerNombre: 'Carlos',
    primerApellido: 'Smoke',
    segundoNombre: 'Test',
    segundoApellido: 'Guard',
    cedula: '8-999-7777',
    fechaNacimiento: '1990-05-15',
    sexo: 'M',
    email: 'smoke-guard@test.com',
    telefono: '6001234',
    celular: '6001234',
    direccion: 'Calle Test 123',
    esPEP: false,
    actividadEconomica: 'Empleado',
    nivelIngresos: 'Medio',
  };
  const vehicleData = {
    placa: 'SMOKETEST99',
    vinChasis: 'VIN123SMOKE456',
    motor: 'MOT123',
    color: 'Rojo',
    marca: 'Toyota',
    modelo: 'Corolla',
    anio: '2024',
    pasajeros: 5,
    puertas: 4,
  };
  const quoteData = {
    numcot: 'SMOKE-GUARD-COT-001',
    planType: 'basico',
    annualPremium: 350.00,
    deducible: 500,
    valorVehiculo: 15000,
  };
  const paymentData = {
    pfCodOper: 'SMOKE-PF-CODOPER-001',
    pfCardType: 'VISA',
    pfCardDisplay: '****9876',
    amount: 350.00,
    installments: 1,
  };

  // ══════════════════════════════════════════════════════════
  // TEST 1: emission-report creates ops_case + EMISION_FALLIDA payment
  // ══════════════════════════════════════════════════════════
  console.log('── TEST 1: emission-report → ops_case + EMISION_FALLIDA payment ──');

  const reportRes = await fetch(`${SITE_URL}/api/operaciones/emission-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      insurerName: 'FEDPA Seguros',
      ramo: 'AUTO',
      cobertura: 'CC',
      clientData,
      vehicleData,
      quoteData,
      paymentData,
      emissionError: 'FEDPA API timeout: Error emitiendo póliza',
      expedienteDocs: {
        cedula: 'uploaded',
        licencia: 'uploaded',
        registroVehicular: 'uploaded',
        firma: 'data:image/png;base64,SMOKETEST',
        photos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'],
      },
    }),
  });

  const reportData = await reportRes.json();
  console.log('  Report response:', JSON.stringify(reportData));
  assert(reportData.success === true, 'emission-report returns success');
  assert(!!reportData.ticket, `Ticket generated: ${reportData.ticket}`);
  assert(!!reportData.caseId, `Case ID: ${reportData.caseId}`);

  if (reportData.caseId) {
    cleanup.push({ table: 'ops_cases', id: reportData.caseId });
  }

  // Wait for async payment creation to complete
  await new Promise(r => setTimeout(r, 2000));

  // ── Verify ops_case has full details ──
  console.log('\n── TEST 1b: Verify ops_case has full expediente details ──');

  const { data: opsCase } = await sb.from('ops_cases')
    .select('*')
    .eq('id', reportData.caseId)
    .single();

  assert(!!opsCase, 'ops_case exists');
  assert(opsCase?.case_type === 'urgencia', `case_type: ${opsCase?.case_type}`);
  assert(opsCase?.category === 'emision_fallida', `category: ${opsCase?.category}`);
  assert(opsCase?.status === 'pendiente', `status: ${opsCase?.status}`);
  assert(opsCase?.urgency_flag === true, 'urgency_flag is true');
  assert(opsCase?.severity === 'high', `severity: ${opsCase?.severity}`);
  assert(opsCase?.client_name === 'Carlos Smoke', `client_name: ${opsCase?.client_name}`);
  assert(opsCase?.cedula === '8-999-7777', `cedula: ${opsCase?.cedula}`);
  assert(opsCase?.client_email === 'smoke-guard@test.com', `email: ${opsCase?.client_email}`);
  assert(opsCase?.insurer_name === 'FEDPA Seguros', `insurer: ${opsCase?.insurer_name}`);

  // Check details JSON
  const details = opsCase?.details || {};
  assert(details.tipo_reporte === 'EMISION_FALLIDA', 'details.tipo_reporte = EMISION_FALLIDA');
  assert(details.cliente?.primerNombre === 'Carlos', 'details.cliente.primerNombre');
  assert(details.vehiculo?.placa === 'SMOKETEST99', 'details.vehiculo.placa');
  assert(details.vehiculo?.vinChasis === 'VIN123SMOKE456', 'details.vehiculo.vinChasis');
  assert(details.vehiculo?.marca === 'Toyota', 'details.vehiculo.marca');
  assert(details.cotizacion?.numcot === 'SMOKE-GUARD-COT-001', 'details.cotizacion.numcot');
  assert(details.pago?.confirmado === true, 'details.pago.confirmado');
  assert(details.pago?.codOper === 'SMOKE-PF-CODOPER-001', 'details.pago.codOper');
  assert(details.pago?.monto === 350, `details.pago.monto: ${details.pago?.monto}`);
  assert(details.error?.mensaje?.includes('FEDPA API timeout'), 'details.error.mensaje contains error');
  assert(details.expediente?.firma === 'data:image/png;base64,SMOKETEST', 'details.expediente.firma');
  assert(Array.isArray(details.expediente?.photos) && details.expediente.photos.length === 3, `expediente photos: ${details.expediente?.photos?.length}`);
  assert(details._meta?.placa === 'SMOKETEST99', 'details._meta.placa');
  assert(details._meta?.cedula === '8-999-7777', 'details._meta.cedula');
  assert(details._meta?.numcot === 'SMOKE-GUARD-COT-001', 'details._meta.numcot');
  console.log('');

  // ── Verify EMISION_FALLIDA payment in adm_cot_payments ──
  console.log('── TEST 1c: Verify EMISION_FALLIDA payment in adm_cot_payments ──');

  // Search by multiple criteria
  const { data: efByCode } = await sb.from('adm_cot_payments')
    .select('*').eq('pf_cod_oper', 'SMOKE-PF-CODOPER-001');
  const { data: efByCase } = await sb.from('adm_cot_payments')
    .select('*').eq('ops_case_id', reportData.caseId);
  const { data: efByNro } = await sb.from('adm_cot_payments')
    .select('*').ilike('nro_poliza', '%SMOKE-GUARD-COT-001%');
  const { data: allEF } = await sb.from('adm_cot_payments')
    .select('id, status, pf_cod_oper, nro_poliza, created_at')
    .eq('status', 'EMISION_FALLIDA').order('created_at', { ascending: false }).limit(3);
  console.log('  By codOper:', efByCode?.length, '| By caseId:', efByCase?.length, '| By nro_poliza:', efByNro?.length);
  console.log('  Recent EMISION_FALLIDA:', JSON.stringify(allEF?.map(p => ({ id: p.id.slice(0,8), cod: p.pf_cod_oper, nro: p.nro_poliza }))));
  
  const efPayment = efByCode?.[0] || efByCase?.[0] || efByNro?.[0];
  assert(!!efPayment, 'EMISION_FALLIDA payment exists in adm_cot_payments');
  if (efPayment) {
    cleanup.push({ table: 'adm_cot_payments', id: efPayment.id });
    assert(efPayment.status === 'EMISION_FALLIDA', `status: ${efPayment.status}`);
    assert(efPayment.client_name === 'Carlos Smoke', `client_name: ${efPayment.client_name}`);
    assert(efPayment.cedula === '8-999-7777', `cedula: ${efPayment.cedula}`);
    assert(Number(efPayment.amount) === 350, `amount: ${efPayment.amount}`);
    assert(efPayment.insurer === 'FEDPA Seguros', `insurer: ${efPayment.insurer}`);
    assert(efPayment.pf_card_type === 'VISA', `pf_card_type: ${efPayment.pf_card_type}`);
    assert(efPayment.pf_card_display === '****9876', `pf_card_display: ${efPayment.pf_card_display}`);
    assert(!!efPayment.pf_confirmed_at, 'pf_confirmed_at is set');
    assert(efPayment.emission_error?.includes('FEDPA API timeout'), `emission_error: ${efPayment.emission_error?.slice(0, 50)}`);
    assert(efPayment.ops_case_id === reportData.caseId, 'ops_case_id links to ops_case');
    assert(efPayment.nro_poliza?.includes('PENDIENTE'), `nro_poliza: ${efPayment.nro_poliza} (contains PENDIENTE)`);
    assert(efPayment.payment_source === 'EMISSION', `payment_source: ${efPayment.payment_source}`);
  }
  console.log('');

  // ── Verify notification was created ──
  console.log('── TEST 1d: Verify master notification ──');
  const { data: notifs } = await sb.from('portal_notifications')
    .select('id, title, body')
    .ilike('title', '%Carlos Smoke%')
    .order('created_at', { ascending: false })
    .limit(1);
  assert(notifs && notifs.length > 0, 'Master notification created');
  if (notifs?.[0]) {
    cleanup.push({ table: 'portal_notifications', id: notifs[0].id });
    assert(notifs[0].title.includes('EMISIÓN FALLIDA'), `title: ${notifs[0].title}`);
    assert(notifs[0].body.includes('350'), `body contains amount: ${notifs[0].body.slice(0, 80)}`);
  }
  console.log('');

  // ══════════════════════════════════════════════════════════
  // TEST 2: charge-guard blocks same cotización (barrier 1)
  // ══════════════════════════════════════════════════════════
  console.log('── TEST 2: charge-guard blocks same cotización (barrier 1) ──');

  const guard1Res = await fetch(`${SITE_URL}/api/paguelofacil/charge-guard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      numcot: 'SMOKE-GUARD-COT-001',
      placa: 'DIFFERENTPLATE',
      cedula: '8-111-2222',
      insurer: 'FEDPA Seguros',
    }),
  });
  const guard1Data = await guard1Res.json();
  console.log('  Guard response:', JSON.stringify(guard1Data));
  assert(guard1Data.allowed === false, 'charge-guard blocks same cotización');
  assert(guard1Data.reason === 'duplicate_quote_payment', `reason: ${guard1Data.reason}`);
  assert(guard1Data.blocked === true, 'blocked flag is true');
  assert(!!guard1Data.blockedMessage, 'blockedMessage provided');
  console.log('');

  // ══════════════════════════════════════════════════════════
  // TEST 3: charge-guard blocks same placa (barrier 2 via ops_cases)
  // ══════════════════════════════════════════════════════════
  console.log('── TEST 3: charge-guard blocks same placa from fresh start (barrier 2) ──');

  const guard2Res = await fetch(`${SITE_URL}/api/paguelofacil/charge-guard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      numcot: 'COMPLETELY-NEW-COT-999',
      placa: 'SMOKETEST99',
      cedula: '8-000-0000',
      insurer: 'INTERNACIONAL',
    }),
  });
  const guard2Data = await guard2Res.json();
  console.log('  Guard response:', JSON.stringify(guard2Data));
  assert(guard2Data.allowed === false, 'charge-guard blocks same placa');
  assert(guard2Data.reason === 'pending_emission_case', `reason: ${guard2Data.reason}`);
  assert(!!guard2Data.ticket, `ticket referenced: ${guard2Data.ticket}`);
  assert(guard2Data.blockedMessage?.includes('SMOKETEST99') || guard2Data.blockedMessage?.includes(guard2Data.ticket), 'blockedMessage mentions ticket');
  console.log('');

  // ══════════════════════════════════════════════════════════
  // TEST 4: charge-guard blocks same cedula+insurer within 24h (barrier 3)
  // ══════════════════════════════════════════════════════════
  console.log('── TEST 4: charge-guard blocks same cedula+insurer within 24h (barrier 3) ──');

  // Create a CONFIRMADO_PF payment for the same cedula+insurer to test barrier 3
  const { data: recentPay } = await sb.from('adm_cot_payments').insert({
    client_name: 'Barrier 3 Test', cedula: '8-333-4444',
    nro_poliza: 'B3-TEST-001', amount: 200, insurer: 'REGIONAL',
    ramo: 'AUTO', status: 'CONFIRMADO_PF',
    payment_date: today, payment_source: 'EMISSION',
    pf_confirmed_at: new Date().toISOString(),
  }).select('id').single();
  if (recentPay) cleanup.push({ table: 'adm_cot_payments', id: recentPay.id });

  const guard3Res = await fetch(`${SITE_URL}/api/paguelofacil/charge-guard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      numcot: 'BRAND-NEW-COT-888',
      placa: 'NEWPLATE123',
      cedula: '8-333-4444',
      insurer: 'REGIONAL',
    }),
  });
  const guard3Data = await guard3Res.json();
  console.log('  Guard response:', JSON.stringify(guard3Data));
  assert(guard3Data.allowed === false, 'charge-guard blocks same cedula+insurer 24h');
  assert(guard3Data.reason === 'recent_duplicate_payment', `reason: ${guard3Data.reason}`);
  console.log('');

  // ══════════════════════════════════════════════════════════
  // TEST 5: charge-guard ALLOWS when no barriers match
  // ══════════════════════════════════════════════════════════
  console.log('── TEST 5: charge-guard allows when clean (no barriers) ──');

  const guardOkRes = await fetch(`${SITE_URL}/api/paguelofacil/charge-guard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      numcot: 'TOTALLY-CLEAN-COT-777',
      placa: 'CLEANPLATE1',
      cedula: '8-555-6666',
      insurer: 'ANCON',
    }),
  });
  const guardOkData = await guardOkRes.json();
  console.log('  Guard response:', JSON.stringify(guardOkData));
  assert(guardOkData.allowed === true, 'charge-guard allows clean request');
  console.log('');

  // ══════════════════════════════════════════════════════════
  // TEST 6: Idempotency — second emission-report for same codOper updates (doesn't duplicate)
  // ══════════════════════════════════════════════════════════
  console.log('── TEST 6: Idempotency — second report for same codOper updates, no duplicate ──');

  const report2Res = await fetch(`${SITE_URL}/api/operaciones/emission-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      insurerName: 'FEDPA Seguros',
      ramo: 'AUTO',
      cobertura: 'CC',
      clientData,
      vehicleData,
      quoteData,
      paymentData,
      emissionError: 'Second attempt error — should update not duplicate',
      expedienteDocs: { cedula: 'uploaded', licencia: 'uploaded' },
    }),
  });
  const report2Data = await report2Res.json();
  assert(report2Data.success === true, 'Second report succeeds');
  if (report2Data.caseId) cleanup.push({ table: 'ops_cases', id: report2Data.caseId });

  // Check no duplicate payment
  const { data: allPays } = await sb.from('adm_cot_payments')
    .select('id, status, emission_error')
    .eq('pf_cod_oper', 'SMOKE-PF-CODOPER-001');
  assert(allPays && allPays.length === 1, `Only 1 payment for codOper (got ${allPays?.length})`);
  if (allPays?.[0]) {
    assert(allPays[0].emission_error?.includes('Second attempt'), `emission_error updated: ${allPays[0].emission_error?.slice(0, 50)}`);
  }
  console.log('');

  // ══════════════════════════════════════════════════════════
  // TEST 7: Verify complete data chain for master review
  // ══════════════════════════════════════════════════════════
  console.log('── TEST 7: Verify complete data chain for master review ──');

  // Master can see: ops_case → details → all client/vehicle/payment/expediente data
  // AND can cross-reference via adm_cot_payments (ops_case_id)
  // Note: test 6 updated ops_case_id to the second case, so query by pf_cod_oper instead
  const { data: linkedPayments } = await sb.from('adm_cot_payments')
    .select('id, status, amount, emission_error, ops_case_id, nro_poliza, pf_cod_oper')
    .eq('pf_cod_oper', 'SMOKE-PF-CODOPER-001');
  assert(linkedPayments && linkedPayments.length >= 1, `Payments for codOper: ${linkedPayments?.length}`);
  
  // Master sees EMISION_FALLIDA in pagos ADM COT with purple badge
  // Payment has: amount, PF data, client, but nro_poliza = PENDIENTE-XXX
  if (linkedPayments?.[0]) {
    assert(linkedPayments[0].status === 'EMISION_FALLIDA', 'Linked payment is EMISION_FALLIDA');
    assert(linkedPayments[0].nro_poliza?.startsWith('PENDIENTE'), 'nro_poliza starts with PENDIENTE (no real policy yet)');
    assert(!!linkedPayments[0].pf_cod_oper, 'Has PF codOper for payment verification');
    assert(!!linkedPayments[0].ops_case_id, 'Has ops_case_id link for master review');
  }
  console.log('');

  // ══════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════
  console.log('── CLEANUP ──');
  
  for (const item of [...cleanup].reverse()) {
    if (item.table === 'ops_cases') {
      await sb.from('ops_activity_log').delete().eq('entity_id', item.id);
    }
    if (item.table === 'adm_cot_payments') {
      await sb.from('adm_cot_audit_log').delete().eq('entity_id', item.id);
    }
    const { error } = await sb.from(item.table).delete().eq('id', item.id);
    if (error) console.log(`  ⚠️ Cleanup ${item.table} ${item.id}: ${error.message}`);
  }
  console.log('  ✅ Test data cleaned up');

  // ══════════════════════════════════════════════════════════
  // RESULTS
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
  console.log('═══════════════════════════════════════════════════');

  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
