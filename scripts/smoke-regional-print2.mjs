/**
 * smoke-regional-print2.mjs
 * ═══════════════════════════════════════════════════════════
 * Thorough investigation of Regional imprimirPoliza for RC policies.
 *
 * Tests:
 *  A. DESA emission — does the response itself contain HTML carátula?
 *  B. PROD imprimirPoliza — try every header/path variation
 *  C. DESA imprimirPoliza — compare DESA vs PROD behavior
 *
 * Run:
 *   node --env-file=.env.local scripts/smoke-regional-print2.mjs
 * ═══════════════════════════════════════════════════════════
 */

import https from 'node:https';
import http from 'node:http';
import { URL as NodeURL } from 'node:url';
import * as fs from 'node:fs';

// ── Credentials ───────────────────────────────────────────────
const PROD_BASE = (process.env.REGIONAL_BASE_URL_PROD || 'https://servicioenlinea.laregionaldeseguros.com/wlrds').trim().replace(/\/$/, '');
const DESA_BASE = (process.env.REGIONAL_BASE_URL_DESA || 'https://desa.laregionaldeseguros.com:10443/desaw').trim().replace(/\/$/, '');

const PROD_USER  = (process.env.REGIONAL_USERNAME_PROD || '').trim();
const PROD_PASS  = (process.env.REGIONAL_PASSWORD_PROD || '').trim();
const PROD_COD   = (process.env.REGIONAL_COD_INTER_PROD || '99').trim();
const PROD_TOKEN = (process.env.REGIONAL_TOKEN_PROD || '').trim();
const PROD_AUTH  = `Basic ${Buffer.from(`${PROD_USER}:${PROD_PASS}`).toString('base64')}`;

const DESA_USER  = (process.env.REGIONAL_USERNAME_DESA || '').trim();
const DESA_PASS  = (process.env.REGIONAL_PASSWORD_DESA || '').trim();
const DESA_COD   = (process.env.REGIONAL_COD_INTER_DESA || '99').trim();
const DESA_TOKEN = (process.env.REGIONAL_TOKEN_DESA || '').trim();
const DESA_AUTH  = `Basic ${Buffer.from(`${DESA_USER}:${DESA_PASS}`).toString('base64')}`;

console.log(`PROD base : ${PROD_BASE}`);
console.log(`DESA base : ${DESA_BASE}`);
console.log(`PROD token: ${PROD_TOKEN.slice(0,12)}...`);
console.log(`DESA token: ${DESA_TOKEN.slice(0,12)}...`);

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
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks), ct: res.headers['content-type'] || '' }));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    if (bodyBuf.length) req.write(bodyBuf);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function classify(buf, status) {
  if (!buf || buf.length === 0) return { type: 'empty', bytes: 0, preview: '' };
  const t = buf.toString('utf8');
  const trimmed = t.trimStart();
  if (buf.slice(0,5).toString('ascii') === '%PDF-') return { type: 'PDF', bytes: buf.length, preview: '' };
  if (trimmed.startsWith('<!') || /^<html/i.test(trimmed)) return { type: 'HTML', bytes: buf.length, preview: trimmed.slice(0,80) };
  try {
    const j = JSON.parse(t);
    return { type: 'JSON', bytes: buf.length, preview: JSON.stringify(j).slice(0, 200), parsed: j };
  } catch {
    return { type: 'TEXT', bytes: buf.length, preview: t.slice(0, 200) };
  }
}

function save(name, buf) {
  const path = `scripts/${name}`;
  fs.writeFileSync(path, buf);
  console.log(`    💾 Saved: ${path}`);
}

// ── Emit RC on a given env ────────────────────────────────────
async function emitRC(label, baseUrl, auth, codInter, token) {
  const seed = Date.now() % 100000;
  const body = {
    codInter,
    plan: '30',
    cliente: {
      nomter: 'SMOKE', apeter: 'PRINT2 TEST',
      fchnac: '1990-04-08', edad: 36,
      sexo: 'M', edocivil: 'S',
      t1numero: '2900000', t2numero: '62900000',
      email: 'smoke2@lideresenseguros.com',
      direccion: { codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1, dirhab: 'Ciudad de Panama' },
      identificacion: { tppersona: 'N', tpodoc: 'C', prov: 8, letra: null, tomo: 200 + (seed % 800), asiento: seed, dv: null, pasaporte: null },
    },
    datosveh: {
      codmarca: 74, codmodelo: 5, anio: 2021,
      numplaca: `SP2${String(seed).slice(-4)}`,
      serialcarroceria: `SMKV2${String(seed).padStart(8,'0')}`,
      serialmotor: `SMKM2${String(seed).padStart(8,'0')}`,
      color: '001',
    },
    condHab: { nomter: 'SMOKE', apeter: 'PRINT2 TEST', sexo: 'M', edocivil: 'S' },
  };

  console.log(`\n[EMIT-RC ${label}] POST ${baseUrl}/regional/auto/emitirPolizaRc`);
  try {
    const { status, buf } = await rawRequest(
      `${baseUrl}/regional/auto/emitirPolizaRc`,
      'POST',
      { 'Content-Type': 'application/json', Authorization: auth, codInter, token },
      JSON.stringify(body),
      60000
    );

    const r = classify(buf, status);
    console.log(`[EMIT-RC ${label}] Status: ${status} | Type: ${r.type} | Bytes: ${r.bytes}`);

    if (r.type === 'HTML') {
      console.log(`[EMIT-RC ${label}] ⚡ HTML in emission response!`);
      save(`caratula_emit_${label.toLowerCase()}.html`, buf);
      return { success: true, htmlInEmission: true, html: buf.toString('utf8') };
    }

    if (r.type === 'JSON') {
      // Log all fields, truncating long strings
      const logData = Object.fromEntries(
        Object.entries(r.parsed).map(([k, v]) => [k, typeof v === 'string' && v.length > 200 ? `[HTML ${v.length}ch]` : v])
      );
      console.log(`[EMIT-RC ${label}] Response:`, JSON.stringify(logData));

      const poliza = r.parsed.poliza || r.parsed.numpoliza || r.parsed.nroPoliza;

      // Check for embedded HTML in any field
      for (const [k, v] of Object.entries(r.parsed)) {
        if (typeof v === 'string' && v.length > 200) {
          const trimmed = v.trimStart();
          if (trimmed.startsWith('<!') || /^<html/i.test(trimmed)) {
            console.log(`[EMIT-RC ${label}] ⚡ HTML in field "${k}" (${v.length} bytes)`);
            save(`caratula_emit_field_${label.toLowerCase()}.html`, Buffer.from(v));
            return { success: true, poliza, htmlInEmission: true, htmlField: k };
          }
        }
      }

      if (!poliza) {
        console.log(`[EMIT-RC ${label}] ❌ No poliza: ${r.parsed.mensaje || r.parsed.message || JSON.stringify(r.parsed)}`);
        return null;
      }

      console.log(`[EMIT-RC ${label}] ✅ Póliza: ${poliza} | No HTML in emission response`);
      return { success: true, poliza, htmlInEmission: false };
    }

    console.log(`[EMIT-RC ${label}] ❌ Unexpected response: ${r.type} ${r.preview}`);
    return null;
  } catch (e) {
    console.log(`[EMIT-RC ${label}] ❌ Request error: ${e.message}`);
    return null;
  }
}

// ── Test imprimirPoliza variation ─────────────────────────────
async function testImprimir(label, url, headers, poliza, delayMs = 0) {
  if (delayMs > 0) await sleep(delayMs);
  console.log(`\n[IMPRIMIR] ${label}`);
  console.log(`    URL    : ${url}`);
  console.log(`    Headers: ${JSON.stringify(Object.keys(headers))}`);
  console.log(`    Poliza : ${poliza}  delay=${delayMs}ms`);

  try {
    const { status, buf, ct } = await rawRequest(url, 'POST', headers, JSON.stringify({ poliza }), 30000);
    const r = classify(buf, status);
    console.log(`    Status : ${status} | CT: ${ct} | Type: ${r.type} | Bytes: ${r.bytes}`);
    if (r.preview) console.log(`    Preview: ${r.preview.slice(0,100)}`);

    if (r.type === 'HTML') {
      console.log(`    ✅ HTML received!`);
      save(`caratula_imprimir_${label.replace(/[^a-z0-9]/gi,'_')}.html`, buf);
      return { ok: true, type: 'html', bytes: r.bytes };
    }
    if (r.type === 'PDF') {
      console.log(`    ✅ PDF received!`);
      save(`caratula_imprimir_${label.replace(/[^a-z0-9]/gi,'_')}.pdf`, buf);
      return { ok: true, type: 'pdf', bytes: r.bytes };
    }
    return { ok: false, status, type: r.type, preview: r.preview };
  } catch (e) {
    console.log(`    ❌ Error: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  REGIONAL PRINT INVESTIGATION v2');
  console.log('═══════════════════════════════════════════════════════════\n');

  const results = {};

  // ── SECTION A: Does DESA emission return HTML? ───────────────
  console.log('\n─── A. DESA EMISSION (does it include HTML?) ───────────────');
  const desaEmit = await emitRC('DESA', DESA_BASE, DESA_AUTH, DESA_COD, DESA_TOKEN);
  results.desaEmitHtml = desaEmit?.htmlInEmission ?? false;
  const desaPoliza = desaEmit?.poliza;

  // ── SECTION B: PROD emission (re-confirm) ───────────────────
  console.log('\n─── B. PROD EMISSION (confirm no HTML in response) ────────');
  const prodEmit = await emitRC('PROD', PROD_BASE, PROD_AUTH, PROD_COD, PROD_TOKEN);
  results.prodEmitHtml = prodEmit?.htmlInEmission ?? false;
  const prodPoliza = prodEmit?.poliza;

  if (!prodPoliza) {
    console.log('\n❌ PROD emission failed — using fallback poliza for print tests');
  }

  const testPoliza = prodPoliza || '10-29-2227301'; // fallback to previous test
  console.log(`\nUsing poliza for print tests: ${testPoliza}`);

  // ── SECTION C: PROD imprimirPoliza — all variations ─────────
  console.log('\n─── C. PROD imprimirPoliza — header/path variations ────────');

  const utilUrl  = `${PROD_BASE}/regional/util/imprimirPoliza`;
  const autoUrl  = `${PROD_BASE}/regional/auto/imprimirPoliza`;
  const utilRcUrl = `${PROD_BASE}/regional/util/imprimirPolizaRc`;
  const autoRcUrl = `${PROD_BASE}/regional/auto/imprimirPolizaRc`;

  // Base headers — camelCase (what we currently use)
  const hCamelRC = { 'Content-Type': 'application/json', Authorization: PROD_AUTH, codInter: PROD_COD, token: PROD_TOKEN };
  // All lowercase
  const hLowerRC = { 'Content-Type': 'application/json', Authorization: PROD_AUTH, codinter: PROD_COD, token: PROD_TOKEN };
  // camelCase + codProv
  const hCamelWithProv = { 'Content-Type': 'application/json', Authorization: PROD_AUTH, codInter: PROD_COD, codProv: PROD_COD, token: PROD_TOKEN };
  // All lowercase + codProv
  const hLowerWithProv = { 'Content-Type': 'application/json', Authorization: PROD_AUTH, codinter: PROD_COD, codprov: PROD_COD, token: PROD_TOKEN };

  const variations = [
    // path, headers, label, delay
    [utilUrl,   hCamelRC,       'util/camelCase',           0],
    [utilUrl,   hLowerRC,       'util/lowercase',           0],
    [utilUrl,   hCamelWithProv, 'util/camelCase+codProv',   0],
    [utilUrl,   hLowerWithProv, 'util/lowercase+codProv',   0],
    [autoUrl,   hCamelRC,       'auto/camelCase',           0],
    [autoUrl,   hLowerRC,       'auto/lowercase',           0],
    [utilRcUrl, hCamelRC,       'utilRc/camelCase',         0],
    [autoRcUrl, hCamelRC,       'autoRc/camelCase',         0],
    // With delay — maybe policy needs time to finalize
    [utilUrl,   hCamelRC,       'util/camelCase/10s-delay', 10000],
    [utilUrl,   hLowerRC,       'util/lowercase/10s-delay', 0], // no extra delay after 10s
  ];

  for (const [url, headers, label, delay] of variations) {
    const r = await testImprimir(label, url, headers, testPoliza, delay);
    results[label] = r;
    if (r.ok) {
      console.log(`\n🎉 FOUND IT: "${label}" worked!`);
      break;
    }
  }

  // ── SECTION D: DESA imprimirPoliza (if DESA poliza available) ─
  if (desaPoliza) {
    console.log(`\n─── D. DESA imprimirPoliza (poliza: ${desaPoliza}) ──────────`);
    const desaUtilUrl = `${DESA_BASE}/regional/util/imprimirPoliza`;
    const desaAutoUrl = `${DESA_BASE}/regional/auto/imprimirPoliza`;
    const hDesa = { 'Content-Type': 'application/json', Authorization: DESA_AUTH, codInter: DESA_COD, token: DESA_TOKEN };
    const hDesaLower = { 'Content-Type': 'application/json', Authorization: DESA_AUTH, codinter: DESA_COD, token: DESA_TOKEN };

    await testImprimir('DESA/util/camelCase', desaUtilUrl, hDesa, desaPoliza);
    await testImprimir('DESA/util/lowercase', desaUtilUrl, hDesaLower, desaPoliza);
    await testImprimir('DESA/auto/camelCase', desaAutoUrl, hDesa, desaPoliza, 2000);
  }

  // ── SUMMARY ─────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  DESA emission returns HTML : ${results.desaEmitHtml ? '✅ YES' : '❌ No'}`);
  console.log(`  PROD emission returns HTML : ${results.prodEmitHtml ? '✅ YES' : '❌ No'}`);
  console.log(`  PROD poliza used           : ${testPoliza}`);

  for (const [key, val] of Object.entries(results)) {
    if (key === 'desaEmitHtml' || key === 'prodEmitHtml') continue;
    const icon = val?.ok ? '✅' : '❌';
    const detail = val?.ok ? `${val.type} (${val.bytes} bytes)` : (val?.preview || val?.error || '{}');
    console.log(`  ${icon} ${key.padEnd(35)} ${detail}`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('\n[SMOKE] Fatal:', e.message);
  process.exit(1);
});
