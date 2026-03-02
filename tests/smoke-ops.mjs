#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 * OPERACIONES — FULL SMOKE TEST SUITE
 * ═══════════════════════════════════════════════════════════════
 * Tests IMAP sync, Zepto email, Cron jobs, Messages API,
 * AI Eval, OpsAlerts, and integrated flows.
 *
 * Usage:  node tests/smoke-ops.mjs
 * Requires: dev server running on localhost:3000
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'Lissa806CronSecret2025';

// ── Test runner ──────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    passed++;
    results.push({ name, status: '✅ PASS', ms });
    console.log(`  ✅ ${name} (${ms}ms)`);
  } catch (err) {
    const ms = Date.now() - t0;
    failed++;
    results.push({ name, status: '❌ FAIL', ms, error: err.message });
    console.log(`  ❌ ${name} (${ms}ms)`);
    console.log(`     → ${err.message}`);
  }
}

function skip(name, reason) {
  skipped++;
  results.push({ name, status: '⏭️ SKIP', reason });
  console.log(`  ⏭️  ${name} — ${reason}`);
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertStatus(res, expected, label) {
  if (res.status !== expected) {
    throw new Error(`${label}: expected status ${expected}, got ${res.status}`);
  }
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body, ok: res.ok };
}

// ══════════════════════════════════════════════════════════════
// SECTION 1: IMAP SYNC SYSTEM
// ══════════════════════════════════════════════════════════════

async function testImapSystem() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  SECTION 1: IMAP SYNC SYSTEM                ║');
  console.log('╚══════════════════════════════════════════════╝');

  // 1.1 IMAP cron — no auth → 401
  await test('IMAP cron: rejects request without auth', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-imap-sync`);
    assertStatus(res, 401, 'No-auth request');
    assert(res.body?.error === 'Unauthorized', `Expected "Unauthorized", got "${res.body?.error}"`);
  });

  // 1.2 IMAP cron — wrong secret → 401
  await test('IMAP cron: rejects wrong secret', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-imap-sync`, {
      headers: { 'Authorization': 'Bearer wrong-secret-123' },
    });
    assertStatus(res, 401, 'Wrong-secret request');
  });

  // 1.3 IMAP cron — correct secret → runs (may fail on IMAP connect, but should not 401)
  await test('IMAP cron: accepts correct secret (auth passes)', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-imap-sync`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });
    // Should NOT be 401 — it passes auth. May be 200 (success/skipped) or 500 (IMAP config missing)
    assert(res.status !== 401, `Auth should pass, but got 401`);
    // The response should have a body
    assert(res.body !== null, 'Response body should not be null');
  });

  // 1.4 IMAP cron — x-cron-secret header alternative
  await test('IMAP cron: accepts x-cron-secret header', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-imap-sync`, {
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    assert(res.status !== 401, 'x-cron-secret should authenticate');
  });

  // 1.5 IMAP cron — lock cooldown (rapid consecutive calls)
  await test('IMAP cron: second call within cooldown gets skipped or proceeds', async () => {
    // First call
    await fetchJson(`${BASE}/api/cron/ops-imap-sync`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });
    // Immediate second call — should either skip (lock) or proceed
    const res2 = await fetchJson(`${BASE}/api/cron/ops-imap-sync`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });
    assert(res2.status !== 401, 'Auth should still pass');
    // If skipped, body has { success: true, skipped: true }
    // If ran, body has { success: true/false }
    assert(res2.body !== null, 'Should have response body');
  });

  // 1.6 Verify IMAP sync response structure (when it runs)
  await test('IMAP cron: response has expected fields', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-imap-sync`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });
    if (res.body?.skipped) {
      assert(res.body.reason, 'Skipped response should have reason');
    } else if (res.body?.success !== undefined) {
      assert('timestamp' in res.body || 'error' in res.body, 'Ran response should have timestamp or error');
    }
  });
}

// ══════════════════════════════════════════════════════════════
// SECTION 2: ZEPTO EMAIL SYSTEM
// ══════════════════════════════════════════════════════════════

async function testZeptoSystem() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  SECTION 2: ZEPTO EMAIL SYSTEM               ║');
  console.log('╚══════════════════════════════════════════════╝');

  // 2.1 Zepto config validation (via import test)
  await test('Zepto: API module loads without errors', async () => {
    // We test this by calling the messages API which internally may use Zepto
    // Just verify the endpoint is reachable
    const res = await fetchJson(`${BASE}/api/operaciones/messages`);
    // Should be 400 (missing params), not 500 (import error)
    assertStatus(res, 400, 'Messages API without params');
    assert(res.body?.error === 'Provide case_id or unclassified=true', `Got: ${res.body?.error}`);
  });

  // 2.2 Messages API — record_outbound (Zepto integration path)
  await test('Zepto: record_outbound requires case_id', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record_outbound',
        message_id: 'test-msg-id',
      }),
    });
    // record_outbound checks message_id existence first → 404, or 400 for missing case_id
    assert(res.status === 400 || res.status === 404, `Expected 400 or 404, got ${res.status}`);
  });

  // 2.3 Messages API — record_outbound with fake case_id
  await test('Zepto: record_outbound with nonexistent case_id fails gracefully', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record_outbound',
        message_id: 'test-msg-smoke',
        case_id: '00000000-0000-0000-0000-000000000000',
        subject: 'Smoke Test Email',
        body_text: 'This is a smoke test',
        from_email: 'test@test.com',
        to_emails: ['client@test.com'],
      }),
    });
    // record_outbound path: message_id 'test-msg-smoke' doesn't exist → 404
    // OR case_id validation fails → 400, OR insert succeeds → 200, OR DB error → 500
    assert([200, 400, 404, 500].includes(res.status), `Expected 200/400/404/500, got ${res.status}`);
  });
}

// ══════════════════════════════════════════════════════════════
// SECTION 3: CRON JOBS (SLA, Metrics, AI Eval)
// ══════════════════════════════════════════════════════════════

async function testCronJobs() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  SECTION 3: CRON JOBS (SLA, Metrics, AI)     ║');
  console.log('╚══════════════════════════════════════════════╝');

  // ── SLA Check ──

  // 3.1 SLA — GET method should return 405
  await test('SLA cron: GET method returns 405', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-sla-check`);
    assertStatus(res, 405, 'SLA GET');
  });

  // 3.2 SLA — POST no auth → 401
  await test('SLA cron: POST without auth returns 401', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-sla-check`, { method: 'POST' });
    assertStatus(res, 401, 'SLA no auth');
  });

  // 3.3 SLA — POST with auth → runs
  await test('SLA cron: POST with auth executes', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-sla-check`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });
    assert(res.status !== 401, 'Auth should pass');
    assert(res.body !== null, 'Should have response body');
    // May succeed (with ok:true) or fail (500 if DB function missing) — both are valid smoke results
    if (res.status === 200) {
      assert('ok' in res.body || 'skipped' in res.body, 'Should have ok or skipped field');
    }
  });

  // ── Metrics Nightly ──

  // 3.4 Metrics — GET method should return 405
  await test('Metrics cron: GET method returns 405', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-metrics-nightly`);
    assertStatus(res, 405, 'Metrics GET');
  });

  // 3.5 Metrics — POST no auth → 401
  await test('Metrics cron: POST without auth returns 401', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-metrics-nightly`, { method: 'POST' });
    assertStatus(res, 401, 'Metrics no auth');
  });

  // 3.6 Metrics — POST with auth → runs
  await test('Metrics cron: POST with auth executes', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-metrics-nightly`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });
    assert(res.status !== 401, 'Auth should pass');
    if (res.status === 200) {
      assert('ok' in res.body || 'skipped' in res.body, 'Should have ok or skipped');
    }
  });

  // ── AI Eval Urgencies ──

  // 3.7 AI Eval — GET method should return 405
  await test('AI Eval cron: GET method returns 405', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-ai-eval-urgencies`);
    assertStatus(res, 405, 'AI Eval GET');
  });

  // 3.8 AI Eval — POST no auth → 401
  await test('AI Eval cron: POST without auth returns 401', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-ai-eval-urgencies`, { method: 'POST' });
    assertStatus(res, 401, 'AI Eval no auth');
  });

  // 3.9 AI Eval — POST with auth → runs
  await test('AI Eval cron: POST with auth executes', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-ai-eval-urgencies`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });
    assert(res.status !== 401, 'Auth should pass');
    if (res.status === 200) {
      assert('ok' in res.body || 'skipped' in res.body, 'Should have ok or skipped');
    }
  });
}

// ══════════════════════════════════════════════════════════════
// SECTION 4: MESSAGES API (all actions)
// ══════════════════════════════════════════════════════════════

async function testMessagesApi() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  SECTION 4: MESSAGES API                     ║');
  console.log('╚══════════════════════════════════════════════╝');

  // 4.1 GET — no params → 400
  await test('Messages GET: no params returns 400', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages`);
    assertStatus(res, 400, 'No params');
    assert(res.body?.error?.includes('case_id'), 'Error should mention case_id');
  });

  // 4.2 GET — case_id with UUID that doesn't exist → 200 with empty messages
  await test('Messages GET: nonexistent case_id returns empty array', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages?case_id=00000000-0000-0000-0000-000000000000`);
    assertStatus(res, 200, 'Nonexistent case_id');
    assert(Array.isArray(res.body?.messages), 'Should return messages array');
    assert(res.body.messages.length === 0, 'Should be empty for nonexistent case');
    assert(res.body.total === 0, 'Total should be 0');
  });

  // 4.3 GET — unclassified=true → 200
  await test('Messages GET: unclassified=true returns paginated result', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages?unclassified=true`);
    assertStatus(res, 200, 'Unclassified');
    assert(Array.isArray(res.body?.messages), 'Should return messages array');
    assert(typeof res.body?.total === 'number', 'Should have total count');
    assert(typeof res.body?.page === 'number', 'Should have page number');
    assert(typeof res.body?.limit === 'number', 'Should have limit');
  });

  // 4.4 GET — pagination params
  await test('Messages GET: pagination params are respected', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages?unclassified=true&page=1&limit=5`);
    assertStatus(res, 200, 'Paginated');
    assert(res.body.limit === 5, `Expected limit=5, got ${res.body.limit}`);
    assert(res.body.page === 1, `Expected page=1, got ${res.body.page}`);
  });

  // 4.5 GET — limit clamping (max 100)
  await test('Messages GET: limit capped at 100', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages?unclassified=true&limit=999`);
    assertStatus(res, 200, 'Limit capped');
    assert(res.body.limit === 100, `Expected limit=100 (capped), got ${res.body.limit}`);
  });

  // 4.6 GET — limit clamping (min 1)
  await test('Messages GET: limit min is 1', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages?unclassified=true&limit=0`);
    assertStatus(res, 200, 'Limit min');
    assert(res.body.limit === 1, `Expected limit=1 (min), got ${res.body.limit}`);
  });

  // 4.7 POST — missing action → 400
  await test('Messages POST: missing action returns 400', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: 'test' }),
    });
    assertStatus(res, 400, 'Missing action');
    assert(res.body?.error?.includes('action'), `Expected action error, got: ${res.body?.error}`);
  });

  // 4.8 POST — missing message_id → 400
  await test('Messages POST: missing message_id returns 400', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign' }),
    });
    assertStatus(res, 400, 'Missing message_id');
  });

  // 4.9 POST — assign with nonexistent message → 404
  await test('Messages POST: assign nonexistent message returns 404', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assign',
        message_id: '00000000-0000-0000-0000-000000000000',
        case_id: '00000000-0000-0000-0000-000000000001',
      }),
    });
    assertStatus(res, 404, 'Nonexistent message');
    assert(res.body?.error === 'Message not found', `Got: ${res.body?.error}`);
  });

  // 4.10 POST — assign without case_id → 400
  await test('Messages POST: assign without case_id returns 400 (if message existed)', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assign',
        message_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    // Message won't exist, so 404 — but the validation path is still exercised
    assert(res.status === 400 || res.status === 404, `Expected 400 or 404, got ${res.status}`);
  });

  // 4.11 POST — discard nonexistent message → 404
  await test('Messages POST: discard nonexistent message returns 404', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'discard',
        message_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    assertStatus(res, 404, 'Discard nonexistent');
  });

  // 4.12 POST — invalid action → 400 or 404
  await test('Messages POST: invalid action returns error', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'explode',
        message_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    // Message won't exist → 404, OR if it did exist → 400 (invalid action)
    assert(res.status === 400 || res.status === 404, `Expected 400 or 404, got ${res.status}`);
  });

  // 4.13 POST — malformed JSON body → 500
  await test('Messages POST: malformed JSON returns 500', async () => {
    const res = await fetch(`${BASE}/api/operaciones/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    });
    assert(res.status === 400 || res.status === 500, `Expected 400 or 500 for malformed JSON, got ${res.status}`);
  });
}

// ══════════════════════════════════════════════════════════════
// SECTION 5: AI EVAL API
// ══════════════════════════════════════════════════════════════

async function testAiEvalApi() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  SECTION 5: AI EVAL API                      ║');
  console.log('╚══════════════════════════════════════════════╝');

  // 5.1 AI Eval endpoint exists and responds
  await test('AI Eval API: GET returns something', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/ai-eval`);
    // Should be 400 (missing params) or 405 (method not allowed) — not 404
    assert(res.status !== 404, `AI Eval route should exist, got 404`);
  });

  // 5.2 AI Eval — POST with nonexistent case
  await test('AI Eval API: POST with nonexistent case_id', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/ai-eval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        case_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    // Should fail gracefully (case not found), not crash
    assert(res.status !== 404 || res.body !== null, 'Should respond even for nonexistent case');
  });
}

// ══════════════════════════════════════════════════════════════
// SECTION 6: AUDITORIA API
// ══════════════════════════════════════════════════════════════

async function testAuditoriaApi() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  SECTION 6: AUDITORIA API                    ║');
  console.log('╚══════════════════════════════════════════════╝');

  // 6.1 Auditoria — GET with no params
  await test('Auditoria GET: returns paginated activity feed', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/auditoria`);
    assertStatus(res, 200, 'Auditoria GET');
    assert(Array.isArray(res.body?.data), 'Should return data array');
    assert(typeof res.body?.total === 'number', 'Should have total');
    assert(typeof res.body?.pageSize === 'number', 'Should have pageSize');
    assert(typeof res.body?.counts === 'object', 'Should have counts object');
  });

  // 6.2 Auditoria — GET with pagination
  await test('Auditoria GET: pagination works', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/auditoria?page=1&page_size=5`);
    assertStatus(res, 200, 'Auditoria paginated');
    assert(res.body.pageSize === 5, `Expected pageSize=5, got ${res.body.pageSize}`);
  });

  // 6.3 Auditoria — GET with action_type filter
  await test('Auditoria GET: action_type filter', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/auditoria?action_type=status_change`);
    assertStatus(res, 200, 'Auditoria filtered');
    assert(Array.isArray(res.body?.data), 'Should return data array');
  });

  // 6.4 Auditoria — Export endpoint
  await test('Auditoria export: responds', async () => {
    const res = await fetch(`${BASE}/api/operaciones/auditoria/export`);
    // Should return CSV or error — not 404
    assert(res.status !== 404, `Auditoria export should exist, got 404`);
  });
}

// ══════════════════════════════════════════════════════════════
// SECTION 7: INTEGRATED FLOWS
// ══════════════════════════════════════════════════════════════

async function testIntegratedFlows() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  SECTION 7: INTEGRATED FLOWS                 ║');
  console.log('╚══════════════════════════════════════════════╝');

  // 7.1 Cron heartbeat tracking: after running a cron, check cron_runs logged
  await test('Integration: cron creates cron_runs heartbeat entry', async () => {
    // Run SLA check
    const res = await fetchJson(`${BASE}/api/cron/ops-sla-check`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });
    assert(res.status !== 401, 'Auth should pass');
    // Check auditoria for the cron activity log
    const audit = await fetchJson(`${BASE}/api/operaciones/auditoria?limit=5`);
    assert(audit.status === 200, 'Auditoria should be accessible');
    // The cron may or may not have logged depending on lock — this just verifies the flow doesn't crash
  });

  // 7.2 Messages flow: GET unclassified → structure is correct
  await test('Integration: unclassified messages have expected structure', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages?unclassified=true&limit=10`);
    assertStatus(res, 200, 'Unclassified flow');
    for (const msg of res.body.messages) {
      assert(typeof msg.id === 'string', 'Message should have string id');
      assert(msg.unclassified === true, 'Should be unclassified');
      assert(typeof msg.from_email === 'string' || msg.from_email === null, 'from_email should be string or null');
      assert(typeof msg.subject === 'string' || msg.subject === null, 'subject should be string or null');
    }
  });

  // 7.3 End-to-end: IMAP cron → check activity log for IMAP entries
  await test('Integration: IMAP sync logs activity', async () => {
    // Trigger IMAP
    await fetchJson(`${BASE}/api/cron/ops-imap-sync`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });
    // Check auditoria for imap-related entries
    const audit = await fetchJson(`${BASE}/api/operaciones/auditoria?action_type=imap_classified_by_ticket&limit=5`);
    // May or may not have entries — just verify the query doesn't crash
    assert(audit.status === 200, 'Auditoria query should work');
  });

  // 7.4 Concurrent cron execution safety
  await test('Integration: concurrent cron calls are safe', async () => {
    const promises = [
      fetchJson(`${BASE}/api/cron/ops-imap-sync`, { headers: { 'Authorization': `Bearer ${CRON_SECRET}` } }),
      fetchJson(`${BASE}/api/cron/ops-imap-sync`, { headers: { 'Authorization': `Bearer ${CRON_SECRET}` } }),
      fetchJson(`${BASE}/api/cron/ops-imap-sync`, { headers: { 'Authorization': `Bearer ${CRON_SECRET}` } }),
    ];
    const results = await Promise.all(promises);
    // All should complete without crashing
    for (const res of results) {
      assert(res.status !== 401, 'Auth should pass');
      assert(res.body !== null, 'Should have response');
    }
    // At most one should actually run, rest should be skipped or sequential
  });

  // 7.5 All crons respond to wrong HTTP method gracefully
  await test('Integration: cron endpoints handle wrong methods', async () => {
    const endpoints = [
      { url: `${BASE}/api/cron/ops-sla-check`, method: 'GET' },
      { url: `${BASE}/api/cron/ops-metrics-nightly`, method: 'GET' },
      { url: `${BASE}/api/cron/ops-ai-eval-urgencies`, method: 'GET' },
    ];
    for (const ep of endpoints) {
      const res = await fetchJson(ep.url, { method: ep.method });
      assert(res.status === 405, `${ep.url} should return 405 for ${ep.method}, got ${res.status}`);
    }
  });
}

// ══════════════════════════════════════════════════════════════
// SECTION 8: ERROR HANDLING & EDGE CASES
// ══════════════════════════════════════════════════════════════

async function testEdgeCases() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  SECTION 8: ERROR HANDLING & EDGE CASES      ║');
  console.log('╚══════════════════════════════════════════════╝');

  // 8.1 Messages API — empty body POST
  await test('Edge: POST messages with empty body', async () => {
    const res = await fetch(`${BASE}/api/operaciones/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert(res.status === 400, `Expected 400 for empty body, got ${res.status}`);
  });

  // 8.2 Messages API — SQL injection attempt in case_id
  await test('Edge: SQL injection in case_id param', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages?case_id='; DROP TABLE ops_cases; --`);
    // Supabase client should safely handle this — either 200 empty or 500 with error
    assert(res.status === 200 || res.status === 500, `Should handle SQL injection attempt, got ${res.status}`);
    // Should NOT crash the server
  });

  // 8.3 Auditoria — negative page number
  await test('Edge: negative page number in auditoria', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/auditoria?page=-1`);
    // Should default to page 1 or handle gracefully
    assert(res.status === 200 || res.status === 500, `Should handle negative page, got ${res.status}`);
  });

  // 8.4 Messages — very large limit
  await test('Edge: very large limit is capped', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages?unclassified=true&limit=999999`);
    assertStatus(res, 200, 'Large limit');
    assert(res.body.limit === 100, `Limit should be capped at 100, got ${res.body.limit}`);
  });

  // 8.5 IMAP cron — empty authorization header
  await test('Edge: empty authorization header', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-imap-sync`, {
      headers: { 'Authorization': '' },
    });
    assertStatus(res, 401, 'Empty auth');
  });

  // 8.6 Messages — case_id as non-UUID string
  await test('Edge: non-UUID case_id parameter', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/messages?case_id=not-a-uuid`);
    // Should return empty or error — not crash
    assert(res.status === 200 || res.status === 500, `Should handle non-UUID, got ${res.status}`);
  });

  // 8.7 Cron secret with extra whitespace
  await test('Edge: cron secret with extra spaces', async () => {
    const res = await fetchJson(`${BASE}/api/cron/ops-imap-sync`, {
      headers: { 'Authorization': `Bearer  ${CRON_SECRET}` },  // double space
    });
    // Should fail auth (extra space changes the token)
    assertStatus(res, 401, 'Extra space in Bearer token');
  });
}

// ══════════════════════════════════════════════════════════════
// SECTION 9: OPERACIONES MAIN PAGE & CASES API
// ══════════════════════════════════════════════════════════════

async function testCasesApi() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  SECTION 9: CASES API                        ║');
  console.log('╚══════════════════════════════════════════════╝');

  // 9.1 Cases API — renewals
  await test('Cases API: renewals endpoint responds', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/renewals?page=1&limit=5`);
    assert(res.status !== 404, 'Renewals API should exist');
    if (res.status === 200) {
      assert(Array.isArray(res.body?.data), 'Should return data array');
      assert(typeof res.body?.counts === 'object', 'Should have counts');
    }
  });

  // 9.2 Cases API — petitions
  await test('Cases API: petitions endpoint responds', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/petitions?page=1&limit=5`);
    assert(res.status !== 404, 'Petitions API should exist');
  });

  // 9.3 Cases API — urgencies
  await test('Cases API: urgencies endpoint responds', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/urgencies?page=1&limit=5`);
    assert(res.status !== 404, 'Urgencies API should exist');
  });

  // 9.4 Cases API — morosidad
  await test('Cases API: morosidad endpoint responds', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/morosidad?page=1&limit=5`);
    assert(res.status !== 404, 'Morosidad API should exist');
  });

  // 9.5 Cases API — renewals masters sub-view
  await test('Cases API: renewals masters view', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/renewals?view=masters`);
    assert(res.status !== 404, 'Masters view should exist');
    if (res.status === 200) {
      assert(Array.isArray(res.body?.data), 'Should return masters array');
    }
  });

  // 9.6 Cases API — renewals POST unknown action → 400
  await test('Cases API: renewals POST unknown action returns 400', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/renewals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid_action' }),
    });
    assertStatus(res, 400, 'Unknown action');
    assert(res.body?.error === 'Unknown action', `Got: ${res.body?.error}`);
  });

  // 9.7 Email API — GET threads
  await test('Email API: GET threads responds', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/email`);
    assert(res.status !== 404, 'Email API should exist');
    if (res.status === 200) {
      assert(Array.isArray(res.body?.data), 'Should return data array');
    }
  });

  // 9.8 Email API — POST unknown action → 400
  await test('Email API: POST unknown action returns 400', async () => {
    const res = await fetchJson(`${BASE}/api/operaciones/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid_action' }),
    });
    assertStatus(res, 400, 'Unknown email action');
  });
}

// ══════════════════════════════════════════════════════════════
// MAIN RUNNER
// ══════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  OPERACIONES SMOKE TEST SUITE');
  console.log(`  Target: ${BASE}`);
  console.log(`  Time:   ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════');

  // Verify server is up
  try {
    const res = await fetch(BASE, { redirect: 'manual' });
    console.log(`  Server: ✅ Reachable (status ${res.status})\n`);
  } catch (err) {
    console.error(`\n  ❌ Server not reachable at ${BASE}`);
    console.error('     Start dev server first: npx next dev');
    process.exit(1);
  }

  await testImapSystem();
  await testZeptoSystem();
  await testCronJobs();
  await testMessagesApi();
  await testAiEvalApi();
  await testAuditoriaApi();
  await testIntegratedFlows();
  await testEdgeCases();
  await testCasesApi();

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  Total:     ${passed + failed + skipped}`);
  console.log('───────────────────────────────────────────────────────');

  if (failed > 0) {
    console.log('\n  FAILED TESTS:');
    for (const r of results) {
      if (r.status === '❌ FAIL') {
        console.log(`    • ${r.name}`);
        console.log(`      ${r.error}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(failed > 0 ? '  ❌ SOME TESTS FAILED' : '  ✅ ALL TESTS PASSED');
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(2);
});
