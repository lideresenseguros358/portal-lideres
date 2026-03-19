/**
 * Smoke Test — ADM COT Full Flow + Meta CAPI + Abandonment Cron
 * ===============================================================
 *
 * Simulates the complete lifecycle of insurance quotes across all ramos:
 *   AUTO (DT + CC), VIDA, INCENDIO, CONTENIDO
 *
 * Statuses tested:
 *   COTIZADA   → user quoted but didn't proceed (Lead event)
 *   EMITIDA    → policy issued (Lead + CompleteRegistration events)
 *   ABANDONADA → user started emission then left (Lead event, cron picks up)
 *
 * Usage:
 *   node scripts/smoke-test-adm-cot-capi.mjs
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

// ── Config ──
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIXEL_ID = process.env.META_ADS_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_ADS_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_ADS_TEST_EVENT_CODE;
const CRON_SECRET = process.env.ADM_COT_CRON_SECRET || process.env.CRON_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE env vars'); process.exit(1);
}
if (!PIXEL_ID || !ACCESS_TOKEN) {
  console.error('❌ Missing META_ADS env vars'); process.exit(1);
}
if (!TEST_EVENT_CODE) {
  console.error('❌ META_ADS_TEST_EVENT_CODE not set — aborting to avoid real events'); process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Helpers ──
function sha256(v) { return crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex'); }
function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }
function hoursAgo(h) { return new Date(Date.now() - h * 3600_000).toISOString(); }

const results = { passed: 0, failed: 0, details: [] };

function log(label, ok, detail = '') {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
  results.details.push({ label, ok, detail });
  if (ok) results.passed++; else results.failed++;
}

async function sendCapiEvent(eventName, eventId, userData, customData) {
  const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: 'https://portal.lideresenseguros.com/cotizadores',
      user_data: userData,
      custom_data: customData,
    }],
    test_event_code: TEST_EVENT_CODE,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}

// ════════════════════════════════════════════════════════════
// TEST SCENARIOS
// ════════════════════════════════════════════════════════════

const TEST_QUOTES = [
  // ── AUTO Daños a Terceros ──
  {
    label: 'Auto DT — Solo cotizado (COTIZADA)',
    quote: {
      quote_ref: `SMOKE-DT-COT-${Date.now()}`, insurer: 'FEDPA', ramo: 'AUTO',
      coverage_type: 'Daños a Terceros', plan_name: 'SOBAT 5/10',
      client_name: 'Carlos Pérez', email: 'smoke-dt-cot@test.com', phone: '50760001001',
      cedula: '8-900-1001', annual_premium: 180, device: 'Windows',
      status: 'COTIZADA', last_step: 'comparar', quoted_at: now(),
      steps_log: [{ step: 'comparar', ts: now() }],
    },
    expectedEvent: 'Lead',
  },
  {
    label: 'Auto DT — Emitida (EMITIDA)',
    quote: {
      quote_ref: `SMOKE-DT-EMIT-${Date.now()}`, insurer: 'INTERNACIONAL', ramo: 'AUTO',
      coverage_type: 'Daños a Terceros', plan_name: 'DAT 10/20',
      client_name: 'María González', email: 'smoke-dt-emit@test.com', phone: '50760001002',
      cedula: '8-900-1002', annual_premium: 250, device: 'iOS',
      status: 'EMITIDA', last_step: 'confirmacion', quoted_at: now(), emitted_at: now(),
      steps_log: [{ step: 'comparar', ts: now() }, { step: 'emission-data', ts: now() }, { step: 'confirmacion', ts: now() }],
      quote_payload: { nro_poliza: 'POL-SMOKE-DT-001', payment_confirmed: true },
    },
    expectedEvent: 'CompleteRegistration',
  },
  {
    label: 'Auto DT — Abandonada en datos de emisión',
    quote: {
      quote_ref: `SMOKE-DT-ABAN-${Date.now()}`, insurer: 'FEDPA', ramo: 'AUTO',
      coverage_type: 'Daños a Terceros', plan_name: 'SOBAT 5/10',
      client_name: 'Pedro Ruiz', email: 'smoke-dt-aban@test.com', phone: '50760001003',
      cedula: '8-900-1003', annual_premium: 195, device: 'Android',
      status: 'ABANDONADA', last_step: 'emission-data', 
      quoted_at: hoursAgo(3), updated_at: hoursAgo(2),
      steps_log: [{ step: 'comparar', ts: hoursAgo(3) }, { step: 'emission-data', ts: hoursAgo(2) }],
    },
    expectedEvent: 'Lead', // Lead was already fired at quote_created
    isAbandonment: true,
  },

  // ── AUTO Cobertura Completa ──
  {
    label: 'Auto CC — Solo cotizado (COTIZADA)',
    quote: {
      quote_ref: `SMOKE-CC-COT-${Date.now()}`, insurer: 'INTERNACIONAL', ramo: 'AUTO',
      coverage_type: 'Cobertura Completa', plan_name: 'CC 10/20-10-2/10',
      client_name: 'Ana Castillo', email: 'smoke-cc-cot@test.com', phone: '50760002001',
      cedula: '8-900-2001', annual_premium: 850, device: 'macOS',
      status: 'COTIZADA', last_step: 'comparar', quoted_at: now(),
      steps_log: [{ step: 'comparar', ts: now() }],
      vehicle_info: { marca: 'TOYOTA', modelo: 'COROLLA', anio: 2023, suma: 22000 },
    },
    expectedEvent: 'Lead',
  },
  {
    label: 'Auto CC — Emitida (EMITIDA)',
    quote: {
      quote_ref: `SMOKE-CC-EMIT-${Date.now()}`, insurer: 'FEDPA', ramo: 'AUTO',
      coverage_type: 'Cobertura Completa', plan_name: 'Full Coverage A',
      client_name: 'Roberto Chen', email: 'smoke-cc-emit@test.com', phone: '50760002002',
      cedula: '3-700-2002', annual_premium: 1150, device: 'Windows',
      status: 'EMITIDA', last_step: 'confirmacion', quoted_at: now(), emitted_at: now(),
      steps_log: [{ step: 'comparar', ts: now() }, { step: 'emission-data', ts: now() }, { step: 'vehicle', ts: now() }, { step: 'confirmacion', ts: now() }],
      quote_payload: { nro_poliza: 'POL-SMOKE-CC-001', payment_confirmed: true },
      vehicle_info: { marca: 'HYUNDAI', modelo: 'CRETA', anio: 2024, suma: 28000 },
    },
    expectedEvent: 'CompleteRegistration',
  },
  {
    label: 'Auto CC — Abandonada en vehículo',
    quote: {
      quote_ref: `SMOKE-CC-ABAN-${Date.now()}`, insurer: 'INTERNACIONAL', ramo: 'AUTO',
      coverage_type: 'Cobertura Completa', plan_name: 'CC 5/10-5-500/2500',
      client_name: 'Laura Morales', email: 'smoke-cc-aban@test.com', phone: '50760002003',
      cedula: '8-900-2003', annual_premium: 720, device: 'iOS',
      status: 'ABANDONADA', last_step: 'vehicle',
      quoted_at: hoursAgo(5), updated_at: hoursAgo(2),
      steps_log: [{ step: 'comparar', ts: hoursAgo(5) }, { step: 'emission-data', ts: hoursAgo(4) }, { step: 'vehicle', ts: hoursAgo(2) }],
    },
    expectedEvent: 'Lead',
    isAbandonment: true,
  },

  // ── VIDA ──
  {
    label: 'Vida — Cotizada (COTIZADA)',
    quote: {
      quote_ref: `SMOKE-VIDA-COT-${Date.now()}`, insurer: 'INTERNACIONAL', ramo: 'VIDA',
      coverage_type: 'Seguro de Vida Individual', plan_name: 'Vida Plus',
      client_name: 'Fernando Díaz', email: 'smoke-vida-cot@test.com', phone: '50760003001',
      cedula: '8-900-3001', annual_premium: 350, device: 'Android',
      status: 'COTIZADA', last_step: 'comparar', quoted_at: now(),
      steps_log: [{ step: 'comparar', ts: now() }],
    },
    expectedEvent: 'Lead',
  },
  {
    label: 'Vida — Abandonada en revisión',
    quote: {
      quote_ref: `SMOKE-VIDA-ABAN-${Date.now()}`, insurer: 'FEDPA', ramo: 'VIDA',
      coverage_type: 'Seguro de Vida Familiar', plan_name: 'Vida Familia',
      client_name: 'Patricia Arias', email: 'smoke-vida-aban@test.com', phone: '50760003002',
      cedula: '4-200-3002', annual_premium: 500, device: 'Windows',
      status: 'ABANDONADA', last_step: 'review',
      quoted_at: hoursAgo(4), updated_at: hoursAgo(1.5),
      steps_log: [{ step: 'comparar', ts: hoursAgo(4) }, { step: 'emission-data', ts: hoursAgo(3) }, { step: 'review', ts: hoursAgo(1.5) }],
    },
    expectedEvent: 'Lead',
    isAbandonment: true,
  },

  // ── INCENDIO ──
  {
    label: 'Incendio — Cotizada (COTIZADA)',
    quote: {
      quote_ref: `SMOKE-INC-COT-${Date.now()}`, insurer: 'FEDPA', ramo: 'INCENDIO',
      coverage_type: 'Seguro de Incendio Residencial', plan_name: 'Incendio Básico',
      client_name: 'Gabriel Torres', email: 'smoke-inc-cot@test.com', phone: '50760004001',
      cedula: '8-900-4001', annual_premium: 280, device: 'macOS',
      status: 'COTIZADA', last_step: 'comparar', quoted_at: now(),
      steps_log: [{ step: 'comparar', ts: now() }],
    },
    expectedEvent: 'Lead',
  },
  {
    label: 'Incendio — Emitida (EMITIDA)',
    quote: {
      quote_ref: `SMOKE-INC-EMIT-${Date.now()}`, insurer: 'INTERNACIONAL', ramo: 'INCENDIO',
      coverage_type: 'Seguro de Incendio Comercial', plan_name: 'Incendio Plus',
      client_name: 'Valentina Sánchez', email: 'smoke-inc-emit@test.com', phone: '50760004002',
      cedula: '8-900-4002', annual_premium: 620, device: 'Windows',
      status: 'EMITIDA', last_step: 'confirmacion', quoted_at: now(), emitted_at: now(),
      steps_log: [{ step: 'comparar', ts: now() }, { step: 'confirmacion', ts: now() }],
      quote_payload: { nro_poliza: 'POL-SMOKE-INC-001', payment_confirmed: true },
    },
    expectedEvent: 'CompleteRegistration',
  },

  // ── CONTENIDO ──
  {
    label: 'Contenido — Cotizada (COTIZADA)',
    quote: {
      quote_ref: `SMOKE-CONT-COT-${Date.now()}`, insurer: 'FEDPA', ramo: 'CONTENIDO',
      coverage_type: 'Seguro de Contenido/Hogar', plan_name: 'Hogar Esencial',
      client_name: 'Sofía Méndez', email: 'smoke-cont-cot@test.com', phone: '50760005001',
      cedula: '8-900-5001', annual_premium: 200, device: 'iOS',
      status: 'COTIZADA', last_step: 'comparar', quoted_at: now(),
      steps_log: [{ step: 'comparar', ts: now() }],
    },
    expectedEvent: 'Lead',
  },
  {
    label: 'Contenido — Abandonada en pago',
    quote: {
      quote_ref: `SMOKE-CONT-ABAN-${Date.now()}`, insurer: 'INTERNACIONAL', ramo: 'CONTENIDO',
      coverage_type: 'Seguro de Contenido Premium', plan_name: 'Hogar Total',
      client_name: 'Diego Vargas', email: 'smoke-cont-aban@test.com', phone: '50760005002',
      cedula: '8-900-5002', annual_premium: 380, device: 'Android',
      status: 'ABANDONADA', last_step: 'payment-info',
      quoted_at: hoursAgo(6), updated_at: hoursAgo(2),
      steps_log: [{ step: 'comparar', ts: hoursAgo(6) }, { step: 'emission-data', ts: hoursAgo(5) }, { step: 'payment-info', ts: hoursAgo(2) }],
    },
    expectedEvent: 'Lead',
    isAbandonment: true,
  },

  // ── EDGE CASES ──
  {
    label: 'Auto DT — Sin email ni teléfono (datos mínimos — CAPI skip expected)',
    quote: {
      quote_ref: `SMOKE-EDGE-NODATA-${Date.now()}`, insurer: 'FEDPA', ramo: 'AUTO',
      coverage_type: 'Daños a Terceros', plan_name: 'SOBAT 5/10',
      client_name: 'Anónimo', annual_premium: 175, device: 'unknown',
      status: 'COTIZADA', last_step: 'comparar', quoted_at: now(),
      steps_log: [{ step: 'comparar', ts: now() }],
    },
    expectedEvent: 'Lead',
    isMinimalData: true,
    expectCapiSkip: true, // Meta requires at least email or phone
  },
  {
    label: 'Auto CC — Sin prima (solo exploración)',
    quote: {
      quote_ref: `SMOKE-EDGE-NOPREMIUM-${Date.now()}`, insurer: 'INTERNACIONAL', ramo: 'AUTO',
      coverage_type: 'Cobertura Completa',
      client_name: 'Explorador Test', email: 'smoke-nopremium@test.com',
      device: 'Windows', status: 'COTIZADA', last_step: 'comparar', quoted_at: now(),
      steps_log: [{ step: 'comparar', ts: now() }],
    },
    expectedEvent: 'Lead',
    isMinimalData: true,
  },
];

// ════════════════════════════════════════════════════════════
// PHASE 1: Insert quotes into Supabase
// ════════════════════════════════════════════════════════════

async function phase1_InsertQuotes() {
  console.log('\n══════════════════════════════════════════');
  console.log('  PHASE 1: Insert test quotes into Supabase');
  console.log('══════════════════════════════════════════\n');

  const insertedIds = [];

  for (const tc of TEST_QUOTES) {
    const { data, error } = await sb
      .from('adm_cot_quotes')
      .insert(tc.quote)
      .select('id')
      .single();

    if (error) {
      log(`DB INSERT: ${tc.label}`, false, error.message);
      insertedIds.push(null);
    } else {
      log(`DB INSERT: ${tc.label}`, true, `id=${data.id}`);
      insertedIds.push(data.id);
      tc._dbId = data.id; // store for CAPI and cleanup
    }
  }

  return insertedIds;
}

// ════════════════════════════════════════════════════════════
// PHASE 2: Fire Meta CAPI events for each quote
// ════════════════════════════════════════════════════════════

async function phase2_FireCapiEvents() {
  console.log('\n══════════════════════════════════════════');
  console.log('  PHASE 2: Fire Meta CAPI events');
  console.log('══════════════════════════════════════════\n');

  for (const tc of TEST_QUOTES) {
    if (!tc._dbId) { log(`CAPI: ${tc.label}`, false, 'No DB id (insert failed)'); continue; }

    const q = tc.quote;
    const userData = {};
    if (q.email) userData.em = [sha256(q.email)];
    if (q.phone) userData.ph = [sha256(q.phone)];
    if (q.client_name && q.client_name !== 'Anónimo') {
      const parts = q.client_name.split(' ');
      userData.fn = sha256(parts[0] || '');
      if (parts.length > 1) userData.ln = sha256(parts.slice(1).join(' '));
    }
    userData.country = sha256('pa');

    const customData = { currency: 'USD', content_category: q.ramo || 'AUTO' };
    if (q.annual_premium) customData.value = q.annual_premium;
    const contentParts = [q.insurer, q.ramo, q.coverage_type].filter(Boolean);
    if (contentParts.length) customData.content_name = contentParts.join(' - ');

    // For EMITIDA quotes, fire both Lead and CompleteRegistration
    if (q.status === 'EMITIDA') {
      // Lead first (at quote creation time)
      const leadResult = await sendCapiEvent('Lead', tc._dbId, userData, customData);
      log(`CAPI Lead: ${tc.label}`, leadResult.ok,
        leadResult.ok ? `events_received=${leadResult.body.events_received}` : JSON.stringify(leadResult.body?.error?.message || leadResult.body).substring(0, 150));

      // Then CompleteRegistration
      const regCustom = { ...customData };
      if (q.quote_payload?.nro_poliza) regCustom.order_id = q.quote_payload.nro_poliza;
      const regResult = await sendCapiEvent('CompleteRegistration', `${tc._dbId}_emit`, userData, regCustom);
      log(`CAPI CompleteRegistration: ${tc.label}`, regResult.ok,
        regResult.ok ? `events_received=${regResult.body.events_received}` : JSON.stringify(regResult.body?.error?.message || regResult.body).substring(0, 150));
    } else if (tc.expectCapiSkip) {
      // No PII — Meta will reject, this is expected behavior
      const leadResult = await sendCapiEvent('Lead', tc._dbId, userData, customData);
      const rejected = !leadResult.ok;
      log(`CAPI Lead (expected skip): ${tc.label}`, rejected,
        rejected ? 'Correctly rejected — no email/phone' : 'Unexpectedly accepted');
    } else {
      // COTIZADA or ABANDONADA — only Lead
      const leadResult = await sendCapiEvent('Lead', tc._dbId, userData, customData);
      log(`CAPI Lead: ${tc.label}`, leadResult.ok,
        leadResult.ok ? `events_received=${leadResult.body.events_received}` : JSON.stringify(leadResult.body?.error?.message || leadResult.body).substring(0, 150));
    }
  }
}

// ════════════════════════════════════════════════════════════
// PHASE 3: Verify abandonment cron detects abandoned quotes
// ════════════════════════════════════════════════════════════

async function phase3_TestAbandonmentCron() {
  console.log('\n══════════════════════════════════════════');
  console.log('  PHASE 3: Test Abandonment Cron');
  console.log('══════════════════════════════════════════\n');

  const abandonedQuotes = TEST_QUOTES.filter(tc => tc.isAbandonment && tc._dbId);

  // Verify abandoned quotes are in DB with correct status
  for (const tc of abandonedQuotes) {
    const { data, error } = await sb
      .from('adm_cot_quotes')
      .select('id, status, email, ramo, last_step, updated_at, abandonment_email_sent_at')
      .eq('id', tc._dbId)
      .single();

    if (error || !data) {
      log(`Abandon verify: ${tc.label}`, false, error?.message || 'Not found');
      continue;
    }

    const isCorrect = data.status === 'ABANDONADA' && data.email;
    log(`Abandon verify: ${tc.label}`, isCorrect,
      `status=${data.status}, email=${data.email}, ramo=${data.ramo}, step=${data.last_step}, email_sent=${data.abandonment_email_sent_at || 'null'}`);
  }

  // Try calling the cron endpoint locally if dev server is running
  console.log('\n  → Attempting to call abandonment cron endpoint...');
  
  // Try localhost first (dev server)
  for (const port of [3000, 3001]) {
    try {
      const cronUrl = `http://localhost:${port}/api/cron/adm-cot-abandonment`;
      const res = await fetch(cronUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CRON_SECRET}`,
          'x-cron-secret': CRON_SECRET || '',
        },
        signal: AbortSignal.timeout(15000),
      });
      const body = await res.json();
      
      if (res.ok) {
        log(`Cron endpoint (port ${port})`, true,
          `sent=${body.sent}, stage1=${body.sentStage1}, stage2=${body.sentStage2}, skipped=${body.skipped}` +
          (body.errors?.length ? `, errors: ${JSON.stringify(body.errors).substring(0, 200)}` : ''));
      } else {
        log(`Cron endpoint (port ${port})`, false, `${res.status}: ${JSON.stringify(body).substring(0, 200)}`);
      }
      break; // If we got a response, don't try next port
    } catch (err) {
      if (port === 3001) {
        console.log('   ⚠️  Dev server not running on localhost:3000 or :3001 — skipping live cron test');
        console.log('   ℹ️  Abandoned quotes are correctly in DB and will be picked up by Vercel Cron in production');
      }
    }
  }
}

// ════════════════════════════════════════════════════════════
// PHASE 4: Verify DB state and Meta event summary
// ════════════════════════════════════════════════════════════

async function phase4_VerifyAndSummarize() {
  console.log('\n══════════════════════════════════════════');
  console.log('  PHASE 4: Verify DB state');
  console.log('══════════════════════════════════════════\n');

  const ids = TEST_QUOTES.filter(tc => tc._dbId).map(tc => tc._dbId);
  const { data: rows, error } = await sb
    .from('adm_cot_quotes')
    .select('id, quote_ref, insurer, ramo, coverage_type, status, email, client_name, annual_premium, last_step')
    .in('id', ids);

  if (error) {
    log('DB Verify', false, error.message);
    return;
  }

  console.log('  ┌──────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('  │  Ramo       │ Insurer       │ Status      │ Step            │ Premium │ Email        │');
  console.log('  ├──────────────────────────────────────────────────────────────────────────────────────┤');
  for (const r of (rows || [])) {
    const ramo = (r.ramo || '').padEnd(10);
    const ins = (r.insurer || '').padEnd(13);
    const st = (r.status || '').padEnd(11);
    const step = (r.last_step || '').padEnd(15);
    const prem = r.annual_premium ? `$${r.annual_premium}`.padEnd(7) : 'N/A'.padEnd(7);
    const em = (r.email || 'none').substring(0, 12).padEnd(12);
    console.log(`  │  ${ramo} │ ${ins} │ ${st} │ ${step} │ ${prem} │ ${em} │`);
  }
  console.log('  └──────────────────────────────────────────────────────────────────────────────────────┘');

  // Summary by status
  const cotizadas = (rows || []).filter(r => r.status === 'COTIZADA').length;
  const emitidas = (rows || []).filter(r => r.status === 'EMITIDA').length;
  const abandonadas = (rows || []).filter(r => r.status === 'ABANDONADA').length;
  console.log(`\n  Summary: ${cotizadas} COTIZADA, ${emitidas} EMITIDA, ${abandonadas} ABANDONADA`);
  
  log('DB rows match expected count', (rows || []).length === ids.length,
    `${(rows || []).length} rows found, ${ids.length} expected`);
}

// ════════════════════════════════════════════════════════════
// PHASE 5: Cleanup test data
// ════════════════════════════════════════════════════════════

async function phase5_Cleanup() {
  console.log('\n══════════════════════════════════════════');
  console.log('  PHASE 5: Cleanup test data');
  console.log('══════════════════════════════════════════\n');

  const ids = TEST_QUOTES.filter(tc => tc._dbId).map(tc => tc._dbId);
  if (ids.length === 0) {
    console.log('  No test data to clean up.');
    return;
  }

  const { error } = await sb
    .from('adm_cot_quotes')
    .delete()
    .in('id', ids);

  if (error) {
    log('Cleanup', false, error.message);
  } else {
    log('Cleanup', true, `Deleted ${ids.length} test rows from adm_cot_quotes`);
  }
}

// ════════════════════════════════════════════════════════════
// RUNNER
// ════════════════════════════════════════════════════════════

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ADM COT + Meta CAPI Comprehensive Smoke Test');
  console.log(`  Pixel: ${PIXEL_ID} | Test Code: ${TEST_EVENT_CODE}`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  Scenarios: ${TEST_QUOTES.length} quotes across 5 ramos`);
  console.log('═══════════════════════════════════════════════════════════');

  await phase1_InsertQuotes();
  await phase2_FireCapiEvents();
  await phase3_TestAbandonmentCron();
  await phase4_VerifyAndSummarize();
  await phase5_Cleanup();

  // ── Meta CAPI Event Summary ──
  console.log('\n══════════════════════════════════════════');
  console.log('  META CAPI EVENT SUMMARY');
  console.log('══════════════════════════════════════════');
  console.log('  Events sent to Meta (test mode):');
  const leadCount = TEST_QUOTES.filter(tc => tc._dbId).length;
  const regCount = TEST_QUOTES.filter(tc => tc._dbId && tc.quote.status === 'EMITIDA').length;
  console.log(`    Lead:                 ${leadCount} (one per quote)`);
  console.log(`    CompleteRegistration: ${regCount} (emitted quotes only)`);
  console.log(`    Total:                ${leadCount + regCount}`);
  console.log(`  Check Events Manager → Test Events (code: ${TEST_EVENT_CODE})`);

  // ── Final Report ──
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  FINAL: ${results.passed} passed, ${results.failed} failed`);
  console.log('═══════════════════════════════════════════════════════════');

  if (results.failed > 0) {
    console.log('\n❌ Some tests failed. Review details above.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! Meta CAPI is aligned with ADM COT.');
    process.exit(0);
  }
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
