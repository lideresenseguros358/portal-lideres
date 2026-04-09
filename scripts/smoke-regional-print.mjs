/**
 * smoke-regional-print.mjs
 * ═══════════════════════════════════════════════════════════
 * Direct smoke test — Regional PROD imprimirPoliza
 *
 * Tests whether the carátula is:
 *  (A) embedded in the RC emission response (documentHtml)
 *  (B) available from imprimirPoliza immediately after emission
 *  (C) available from imprimirPoliza after a delay
 *
 * Bypasses the portal — hits Regional API directly using
 * credentials from .env.local
 *
 * Run (from project root):
 *   node --env-file=.env.local scripts/smoke-regional-print.mjs
 * ═══════════════════════════════════════════════════════════
 */

import https from 'node:https';
import http from 'node:http';
import { URL as NodeURL } from 'node:url';
import * as fs from 'node:fs';

// ── Credentials from env ─────────────────────────────────────
const ENV    = process.env.REGIONAL_ENV || 'production';
const IS_PROD = ENV === 'production';

const BASE_URL   = IS_PROD
  ? (process.env.REGIONAL_BASE_URL_PROD || 'https://servicioenlinea.laregionaldeseguros.com/wlrds')
  : (process.env.REGIONAL_BASE_URL_DESA || 'https://desa.laregionaldeseguros.com:10443/desaw');
const USERNAME   = IS_PROD ? process.env.REGIONAL_USERNAME_PROD : process.env.REGIONAL_USERNAME_DESA;
const PASSWORD   = IS_PROD ? process.env.REGIONAL_PASSWORD_PROD : process.env.REGIONAL_PASSWORD_DESA;
const COD_INTER  = IS_PROD ? process.env.REGIONAL_COD_INTER_PROD : process.env.REGIONAL_COD_INTER_DESA;
const TOKEN      = IS_PROD ? process.env.REGIONAL_TOKEN_PROD : process.env.REGIONAL_TOKEN_DESA;
const TOKEN_CC   = process.env[`REGIONAL_TOKEN_CC_${IS_PROD ? 'PROD' : 'DESA'}`] || TOKEN;

const AUTH = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}`;

console.log(`\nEnv: ${ENV} | Base: ${BASE_URL}`);
console.log(`CodInter: ${COD_INTER} | Token: ${TOKEN?.slice(0,12)}... | TokenCC: ${TOKEN_CC?.slice(0,12)}...`);

// ── HTTP helper ───────────────────────────────────────────────
function rawRequest(url, method, headers, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const parsed = new NodeURL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const bodyBuf = body ? Buffer.from(body, 'utf8') : Buffer.alloc(0);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: { ...headers, 'Content-Length': bodyBuf.length.toString() },
      rejectUnauthorized: false,
    };
    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks), headers: res.headers }));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    if (bodyBuf.length) req.write(bodyBuf);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function describe(buf) {
  if (!buf || buf.length === 0) return '(empty)';
  const t = buf.toString('utf8');
  if (buf.slice(0,5).toString('ascii') === '%PDF-') return `PDF (${buf.length} bytes)`;
  if (t.trimStart().startsWith('<!') || /^<html/i.test(t.trimStart())) return `HTML (${buf.length} bytes)`;
  try {
    const j = JSON.parse(t);
    return `JSON (${buf.length} bytes): ${JSON.stringify(j).slice(0, 200)}`;
  } catch {
    return `TEXT (${buf.length} bytes): ${t.slice(0, 200)}`;
  }
}

// ── Step 1: Emit RC policy ────────────────────────────────────
async function emitRC() {
  const seed = Date.now() % 100000;
  const emitBody = {
    codInter: COD_INTER,
    plan: '30',    // Basic DT plan
    cliente: {
      nomter: 'SMOKE',
      apeter: 'PRINT TEST',
      fchnac: '1990-04-08',
      edad: 36,
      sexo: 'M',
      edocivil: 'S',
      t1numero: '2900000',
      t2numero: '62900000',
      email: 'smoke@lideresenseguros.com',
      direccion: { codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1, dirhab: 'Ciudad de Panama' },
      identificacion: { tppersona: 'N', tpodoc: 'C', prov: 8, letra: null, tomo: 100 + (seed % 900), asiento: seed, dv: null, pasaporte: null },
    },
    datosveh: {
      codmarca: 74,
      codmodelo: 5,
      anio: 2022,
      numplaca: `SPT${String(seed).slice(-4)}`,
      serialcarroceria: `SMOKEVIN${String(seed).padStart(8,'0')}`,
      serialmotor: `SMOKEMOT${String(seed).padStart(8,'0')}`,
      color: '001',
    },
    condHab: { nomter: 'SMOKE', apeter: 'PRINT TEST', sexo: 'M', edocivil: 'S' },
  };

  const url = `${BASE_URL}/regional/auto/emitirPolizaRc`;
  console.log(`\n[EMIT-RC] POST ${url}`);

  const { status, buf } = await rawRequest(url, 'POST', {
    'Content-Type': 'application/json',
    Authorization: AUTH,
    codInter: COD_INTER,
    token: TOKEN,
  }, JSON.stringify(emitBody), 60000);

  console.log(`[EMIT-RC] Status: ${status} — ${describe(buf)}`);

  const text = buf.toString('utf8');
  let data;
  try { data = JSON.parse(text); } catch { data = null; }

  if (!data) {
    // Check if response is HTML (document returned directly)
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<!') || /^<html/i.test(trimmed)) {
      console.log(`[EMIT-RC] ⚡ Response IS HTML (${text.length} bytes) — carátula embedded in emission!`);
      fs.writeFileSync('scripts/caratula_rc_emit.html', text);
      console.log(`[EMIT-RC] Saved to scripts/caratula_rc_emit.html`);
      return { success: true, htmlFromEmit: text };
    }
    console.error('[EMIT-RC] Failed — not JSON or HTML');
    return null;
  }

  // Log all fields (truncate long strings)
  const logData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, typeof v === 'string' && v.length > 200 ? `[string ${v.length}ch]` : v])
  );
  console.log('[EMIT-RC] Full response:', JSON.stringify(logData, null, 2));

  const poliza = data.poliza || data.numpoliza || data.nroPoliza;
  if (!poliza) {
    console.error('[EMIT-RC] No poliza in response — failed:', data.message || data.mensaje || 'unknown');
    return null;
  }

  console.log(`[EMIT-RC] ✅ Póliza: ${poliza}`);

  // Check for embedded HTML in any field
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string' && v.length > 200) {
      const t = v.trimStart();
      if (t.startsWith('<!') || /^<html/i.test(t)) {
        console.log(`[EMIT-RC] ⚡ HTML found in field "${k}" (${v.length} bytes)`);
        fs.writeFileSync('scripts/caratula_rc_emit.html', v);
        return { success: true, poliza, htmlFromEmit: v };
      }
    }
  }

  console.log('[EMIT-RC] No HTML in emission response — will test imprimirPoliza separately');
  return { success: true, poliza, htmlFromEmit: null };
}

// ── Step 2: Test imprimirPoliza at different delays ────────────
async function testImprimir(poliza, delayMs, tokenType = 'rc') {
  if (delayMs > 0) {
    console.log(`\n[IMPRIMIR] Waiting ${delayMs}ms before calling imprimirPoliza...`);
    await sleep(delayMs);
  }

  const url = `${BASE_URL}/regional/util/imprimirPoliza`;
  const headers = tokenType === 'rc'
    ? { 'Content-Type': 'application/json', Authorization: AUTH, codInter: COD_INTER, token: TOKEN }
    : { 'Content-Type': 'application/json', Authorization: AUTH, codInter: COD_INTER, codProv: COD_INTER, token: TOKEN_CC };

  console.log(`\n[IMPRIMIR] POST ${url}  poliza=${poliza}  tokenType=${tokenType}  delay=${delayMs}ms`);

  const { status, buf } = await rawRequest(url, 'POST', headers, JSON.stringify({ poliza }), 30000);
  const result = describe(buf);
  console.log(`[IMPRIMIR] Status: ${status} — ${result}`);

  const text = buf.toString('utf8');
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<!') || /^<html/i.test(trimmed)) {
    const fname = `scripts/caratula_rc_imprimir_delay${delayMs}_${tokenType}.html`;
    fs.writeFileSync(fname, text);
    console.log(`[IMPRIMIR] ✅ HTML saved to ${fname}`);
    return { ok: true, type: 'html', bytes: buf.length };
  }
  if (buf.slice(0,5).toString('ascii') === '%PDF-') {
    const fname = `scripts/caratula_rc_imprimir_delay${delayMs}_${tokenType}.pdf`;
    fs.writeFileSync(fname, buf);
    console.log(`[IMPRIMIR] ✅ PDF saved to ${fname}`);
    return { ok: true, type: 'pdf', bytes: buf.length };
  }
  return { ok: false, status, raw: text.slice(0, 300) };
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  REGIONAL PRINT SMOKE TEST');
  console.log('═══════════════════════════════════════════════════════════');

  // Emit RC policy
  const emitResult = await emitRC();
  if (!emitResult) {
    console.error('\n❌ RC emission failed — cannot test imprimirPoliza');
    process.exit(1);
  }

  if (emitResult.htmlFromEmit) {
    console.log('\n✅ RESULT: Carátula is EMBEDDED in the emission response!');
    console.log('   Action: emit-rc/route.ts already handles this via extractHtmlFromData.');
    console.log('   If it\'s not being captured, check the documentHtml field handling.');
    process.exit(0);
  }

  const { poliza } = emitResult;
  console.log(`\nPóliza ${poliza} — testing imprimirPoliza with different delays & tokens...`);

  // Test: immediate (0ms), with rc token
  const r1 = await testImprimir(poliza, 0, 'rc');

  // Test: 5s delay, rc token
  const r2 = await testImprimir(poliza, 5000, 'rc');

  // Test: 5s delay, cc token (maybe imprimirPoliza only works with CC token?)
  const r3 = await testImprimir(poliza, 0, 'cc');

  // Test: 10s delay, rc token
  const r4 = await testImprimir(poliza, 5000, 'rc');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RESUMEN');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Emission HTML embedded : ❌ No`);
  console.log(`  Imprimir @ 0ms  (RC)   : ${r1.ok ? '✅ ' + r1.type + ' ' + r1.bytes + 'b' : '❌ ' + r1.raw?.slice(0,100)}`);
  console.log(`  Imprimir @ 5s   (RC)   : ${r2.ok ? '✅ ' + r2.type + ' ' + r2.bytes + 'b' : '❌ ' + r2.raw?.slice(0,100)}`);
  console.log(`  Imprimir @ 0ms  (CC)   : ${r3.ok ? '✅ ' + r3.type + ' ' + r3.bytes + 'b' : '❌ ' + r3.raw?.slice(0,100)}`);
  console.log(`  Imprimir @ 10s  (RC)   : ${r4.ok ? '✅ ' + r4.type + ' ' + r4.bytes + 'b' : '❌ ' + r4.raw?.slice(0,100)}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('\n[SMOKE] Fatal error:', e.message);
  process.exit(1);
});
