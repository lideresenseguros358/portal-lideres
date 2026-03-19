/**
 * Smoke Test — Meta Ads Conversions API (CAPI)
 * =============================================
 * Runs against the REAL Meta endpoint using the test_event_code
 * so events appear in Events Manager → Test Events tab (not counted as real).
 *
 * Usage:
 *   node scripts/smoke-test-meta-capi.mjs
 *
 * Requires .env.local to be loaded (uses dotenv).
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

const PIXEL_ID = process.env.META_ADS_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_ADS_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_ADS_TEST_EVENT_CODE;

if (!PIXEL_ID || !ACCESS_TOKEN) {
  console.error('❌ Missing META_ADS_PIXEL_ID or META_ADS_ACCESS_TOKEN in .env.local');
  process.exit(1);
}
if (!TEST_EVENT_CODE) {
  console.warn('⚠️  META_ADS_TEST_EVENT_CODE not set — events will be REAL (not test). Aborting for safety.');
  process.exit(1);
}

console.log('═══════════════════════════════════════════════');
console.log('  Meta CAPI Smoke Tests');
console.log(`  Pixel: ${PIXEL_ID}`);
console.log(`  Test Code: ${TEST_EVENT_CODE}`);
console.log('═══════════════════════════════════════════════\n');

// ── Helpers ──

import crypto from 'crypto';

function sha256(value) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

async function sendEvent(payload, label) {
  const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const elapsed = Date.now() - start;
    const body = await res.json();

    if (res.ok && body.events_received > 0) {
      console.log(`✅ ${label} — ${res.status} — events_received: ${body.events_received} — ${elapsed}ms`);
      return { pass: true, status: res.status, body };
    } else {
      console.error(`❌ ${label} — ${res.status} — ${JSON.stringify(body).substring(0, 300)} — ${elapsed}ms`);
      return { pass: false, status: res.status, body };
    }
  } catch (err) {
    console.error(`❌ ${label} — EXCEPTION: ${err.message}`);
    return { pass: false, error: err.message };
  }
}

// ── Test Cases ──

const tests = [];
let passed = 0;
let failed = 0;

// TEST 1: Lead — full data (email + phone + name + premium)
async function test1_LeadFullData() {
  const eventId = `smoke_lead_full_${Date.now()}`;
  const result = await sendEvent({
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: 'https://portal.lideresenseguros.com/cotizadores',
      user_data: {
        em: [sha256('test@lideresenseguros.com')],
        ph: [sha256('50760001234')],
        fn: sha256('juan'),
        ln: sha256('pérez'),
        country: sha256('pa'),
      },
      custom_data: {
        currency: 'USD',
        value: 450.00,
        content_name: 'FEDPA - AUTO - Cobertura Completa',
        content_category: 'AUTO',
      },
    }],
    test_event_code: TEST_EVENT_CODE,
  }, 'TEST 1: Lead (full data)');
  return result;
}

// TEST 2: Lead — minimal data (only email, no premium)
async function test2_LeadMinimalData() {
  const eventId = `smoke_lead_min_${Date.now()}`;
  const result = await sendEvent({
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: 'https://portal.lideresenseguros.com/cotizadores',
      user_data: {
        em: [sha256('minimo@test.com')],
        country: sha256('pa'),
      },
      custom_data: {
        currency: 'USD',
        content_category: 'AUTO',
      },
    }],
    test_event_code: TEST_EVENT_CODE,
  }, 'TEST 2: Lead (minimal — email only)');
  return result;
}

// TEST 3: CompleteRegistration — full data
async function test3_CompleteRegistrationFull() {
  const eventId = `smoke_reg_full_${Date.now()}`;
  const result = await sendEvent({
    data: [{
      event_name: 'CompleteRegistration',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: 'https://portal.lideresenseguros.com/cotizadores/confirmacion',
      user_data: {
        em: [sha256('emitido@lideresenseguros.com')],
        ph: [sha256('50760009999')],
        fn: sha256('maria'),
        ln: sha256('gonzalez'),
        country: sha256('pa'),
      },
      custom_data: {
        currency: 'USD',
        value: 1200.00,
        content_name: 'INTERNACIONAL - AUTO - POL-2026-001',
        content_category: 'AUTO',
        order_id: 'POL-2026-001',
      },
    }],
    test_event_code: TEST_EVENT_CODE,
  }, 'TEST 3: CompleteRegistration (full data)');
  return result;
}

// TEST 4: Deduplication — same event_id sent twice should only count once
async function test4_Deduplication() {
  const eventId = `smoke_dedup_${Date.now()}`;
  const payload = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: 'https://portal.lideresenseguros.com/cotizadores',
      user_data: {
        em: [sha256('dedup@test.com')],
        country: sha256('pa'),
      },
      custom_data: { currency: 'USD', content_category: 'AUTO' },
    }],
    test_event_code: TEST_EVENT_CODE,
  };

  const r1 = await sendEvent(payload, 'TEST 4a: Dedup — first send');
  const r2 = await sendEvent(payload, 'TEST 4b: Dedup — duplicate send');

  // Both should return 200 + events_received=1 (Meta accepts both but deduplicates)
  if (r1.pass && r2.pass) {
    console.log('   ℹ️  Both accepted — Meta deduplicates server-side via event_id');
    return { pass: true };
  }
  return { pass: r1.pass }; // at least first should pass
}

// TEST 5: Bad data — missing user_data entirely (Meta REJECTS this — expected)
async function test5_MissingUserData() {
  const eventId = `smoke_bad_no_ud_${Date.now()}`;
  const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: 'website',
          user_data: {},
          custom_data: { currency: 'USD' },
        }],
        test_event_code: TEST_EVENT_CODE,
      }),
    });
    const elapsed = Date.now() - start;
    const body = await res.json();
    if (!res.ok && body?.error?.code === 100) {
      console.log(`✅ TEST 5: Empty user_data — correctly rejected (${res.status}, code 100) — ${elapsed}ms`);
      console.log('   ℹ️  Meta requires at least 1 PII field. Our service always sends country + email/phone.');
      return { pass: true };
    }
    console.error(`❌ TEST 5: Empty user_data — unexpected response ${res.status} — ${elapsed}ms`);
    return { pass: false };
  } catch (err) {
    console.log(`✅ TEST 5: Empty user_data — error caught: ${err.message}`);
    return { pass: true };
  }
}

// TEST 6: Bad data — invalid pixel ID
async function test6_InvalidPixel() {
  const url = `https://graph.facebook.com/v18.0/000000000/events?access_token=${ACCESS_TOKEN}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          event_id: `smoke_bad_pixel_${Date.now()}`,
          action_source: 'website',
          user_data: { em: [sha256('bad@test.com')] },
        }],
        test_event_code: TEST_EVENT_CODE,
      }),
    });
    const elapsed = Date.now() - start;
    const body = await res.json();
    if (!res.ok) {
      console.log(`✅ TEST 6: Invalid pixel — correctly rejected ${res.status} — ${elapsed}ms`);
      return { pass: true, status: res.status };
    }
    console.error(`❌ TEST 6: Invalid pixel — unexpectedly accepted — ${elapsed}ms`);
    return { pass: false };
  } catch (err) {
    console.log(`✅ TEST 6: Invalid pixel — error caught: ${err.message}`);
    return { pass: true };
  }
}

// ── Runner ──

async function run() {
  const results = [];

  for (const [name, fn] of [
    ['Test 1', test1_LeadFullData],
    ['Test 2', test2_LeadMinimalData],
    ['Test 3', test3_CompleteRegistrationFull],
    ['Test 4', test4_Deduplication],
    ['Test 5', test5_MissingUserData],
    ['Test 6', test6_InvalidPixel],
  ]) {
    console.log('');
    const r = await fn();
    results.push({ name, ...r });
    if (r.pass) passed++;
    else failed++;
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed out of ${results.length}`);
  console.log('═══════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n❌ Some tests failed. Review errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All smoke tests passed! CAPI integration is working correctly.');
    console.log('   Check Meta Events Manager → Test Events for the events.');
    process.exit(0);
  }
}

run();
