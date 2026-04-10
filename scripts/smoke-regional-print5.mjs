/**
 * smoke-regional-print5.mjs
 * Test with real customer poliza 10-29-2227303 (Juan Perez, KIA SELTOS 2026)
 * and explore every remaining possibility.
 */
import https from 'node:https';
import http from 'node:http';
import { URL as NodeURL } from 'node:url';
import * as fs from 'node:fs';

const PROD  = (process.env.REGIONAL_BASE_URL_PROD || '').trim().replace(/\/$/, '');
const COD   = (process.env.REGIONAL_COD_INTER_PROD || '99').trim();
const TOKEN = (process.env.REGIONAL_TOKEN_PROD || '').trim();
const USER  = (process.env.REGIONAL_USERNAME_PROD || '').trim();
const PASS  = (process.env.REGIONAL_PASSWORD_PROD || '').trim();
const AUTH  = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;

// Confirm exact token bytes being sent
console.log(`Token length: ${TOKEN.length}, last 5 chars: [${TOKEN.slice(-5)}]`);
console.log(`Auth header: Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64').slice(0,20)}...`);

function rawRequest(url, method, headers, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const parsed = new NodeURL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const bodyBuf = body ? Buffer.from(body, 'utf8') : Buffer.alloc(0);
    const req = lib.request({
      hostname: parsed.hostname, port: parsed.port || 443,
      path: parsed.pathname + parsed.search, method,
      headers: { ...headers, 'Content-Length': bodyBuf.length.toString() },
      rejectUnauthorized: false,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode, buf: Buffer.concat(chunks),
        ct: res.headers['content-type'] || '',
        allow: res.headers['allow'] || '',
      }));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
    if (bodyBuf.length) req.write(bodyBuf);
    req.end();
  });
}

function classify(buf) {
  const t = buf.toString('utf8');
  const tr = t.trimStart();
  if (buf.slice(0,5).toString('ascii') === '%PDF-') return { type:'PDF', bytes:buf.length };
  if (tr.startsWith('<!') || /^<html/i.test(tr)) return { type:'HTML', bytes:buf.length, preview:tr.slice(0,100) };
  try { return { type:'JSON', bytes:buf.length, preview:JSON.stringify(JSON.parse(t)).slice(0,300), raw:t }; }
  catch { return { type:'TEXT', bytes:buf.length, preview:t.slice(0,300) }; }
}

async function try_(label, url, method, headers, body) {
  const shortUrl = url.replace(PROD,'');
  process.stdout.write(`  [${label}] ${method} ${shortUrl} ... `);
  try {
    const { status, buf, ct, allow } = await rawRequest(url, method, headers, body, 30000);
    const r = classify(buf);
    process.stdout.write(`${status} | ${r.type} ${r.bytes}b${allow ? ' allow:'+allow : ''}\n`);
    if (r.preview && r.preview !== '{}' && r.type !== 'PDF') console.log(`    ${r.preview.slice(0,150)}`);
    if ((r.type === 'HTML' && r.bytes > 5000) || r.type === 'PDF') {
      const ext = r.type === 'PDF' ? 'pdf' : 'html';
      const fname = `scripts/caratula_v5_${label.replace(/[^a-z0-9]/gi,'_')}.${ext}`;
      fs.writeFileSync(fname, buf);
      console.log(`    ✅✅✅ FOUND IT — Saved: ${fname}`);
      return true;
    }
    return false;
  } catch(e) {
    process.stdout.write(`ERROR: ${e.message}\n`);
    return false;
  }
}

async function main() {
  // The REAL customer poliza from Juan Perez emission
  const REAL_POLIZA = '10-29-2227303';
  const enc = encodeURIComponent(REAL_POLIZA);

  const base  = { 'Content-Type':'application/json', Authorization:AUTH, codInter:COD, token:TOKEN };
  const withP = { ...base, codProv:COD };

  console.log(`\nPROD: ${PROD}`);
  console.log(`Real poliza: ${REAL_POLIZA}\n`);

  // 1. GET with poliza in path — real (non-smoke) poliza
  console.log('─── 1. GET /util/imprimirPoliza/{realPoliza} ────────────────');
  await try_('GET_real_noAuth',  `${PROD}/regional/util/imprimirPoliza/${enc}`, 'GET', { 'Content-Type':'application/json', codInter:COD, token:TOKEN }, null);
  await try_('GET_real_withAuth',`${PROD}/regional/util/imprimirPoliza/${enc}`, 'GET', base, null);
  await try_('GET_real_withProv',`${PROD}/regional/util/imprimirPoliza/${enc}`, 'GET', withP, null);

  // 2. POST — but what if body field is different?
  console.log('\n─── 2. POST — alternate field names / encoded formats ───────');
  const postBodies = [
    { poliza: REAL_POLIZA },
    { poliza: REAL_POLIZA, codInter: COD },
    { poliza: REAL_POLIZA, codInter: parseInt(COD) },
    { nPoliza: REAL_POLIZA },
    { numPol: REAL_POLIZA },
    { strPoliza: REAL_POLIZA },
    // Maybe the format needs slashes instead of dashes?
    { poliza: REAL_POLIZA.replace(/-/g, '/') },
    // Maybe the poliza needs to be just the numeric part after the branch
    { poliza: REAL_POLIZA.split('-').pop() },
    // With explicit ramo
    { poliza: REAL_POLIZA, ramo: 'RC' },
    { poliza: REAL_POLIZA, ramo: 'DT' },
    { poliza: REAL_POLIZA, tipo: '10' },   // branch code
    { poliza: REAL_POLIZA, codRamo: 'DT' },
    { poliza: REAL_POLIZA, codRamo: 'RC' },
    // Maybe it expects planCode
    { poliza: REAL_POLIZA, plan: '31' },
  ];
  for (const body of postBodies) {
    const found = await try_(`POST_${JSON.stringify(body).slice(0,40)}`, `${PROD}/regional/util/imprimirPoliza`, 'POST', base, JSON.stringify(body));
    if (found) break;
    await new Promise(r => setTimeout(r, 150));
  }

  // 3. Completely different URL patterns
  console.log('\n─── 3. Unexplored URL patterns ─────────────────────────────');
  const paths = [
    `/regional/util/imprimirPolizaRC`,
    `/regional/util/imprimirPolizaDT`,
    `/regional/util/imprimirPolizaDanos`,
    `/regional/rc/imprimirPoliza`,
    `/regional/rc/imprimir`,
    `/regional/auto/imprimirPolizaRC`,
    `/regional/dt/imprimirPoliza`,
    `/regional/ws/imprimirPoliza`,
    `/regional/util/poliza/${enc}`,
    `/regional/util/poliza/${enc}/imprimir`,
    `/regional/auto/poliza/${enc}/imprimir`,
    `/regional/util/documento/${enc}`,
    `/regional/util/caratula`,
    `/regional/util/caratulaPoliza`,
    `/regional/auto/caratulaPoliza`,
  ];
  for (const p of paths) {
    await try_(`path_${p.replace(/\//g,'_')}`, `${PROD}${p}`, 'POST', base, JSON.stringify({ poliza: REAL_POLIZA }));
    await new Promise(r => setTimeout(r, 100));
  }

  // 4. GET with query params (poliza in path returned ORA-01422 for smoke data — maybe
  //    real data works but needs Authorization removed or different header combo)
  console.log('\n─── 4. GET variations ───────────────────────────────────────');
  await try_('GET_noToken',   `${PROD}/regional/util/imprimirPoliza/${enc}`, 'GET', { 'Content-Type':'application/json', Authorization:AUTH, codInter:COD }, null);
  await try_('GET_noCodeInter', `${PROD}/regional/util/imprimirPoliza/${enc}`, 'GET', { 'Content-Type':'application/json', Authorization:AUTH, token:TOKEN }, null);
  await try_('GET_noBasicAuth', `${PROD}/regional/util/imprimirPoliza/${enc}`, 'GET', { 'Content-Type':'application/json', codInter:COD, token:TOKEN }, null);

  console.log('\nDone.\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
