/**
 * smoke-regional-print4.mjs
 * Test GET /regional/util/imprimirPoliza/{poliza} — 405 suggests it exists as GET
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
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks), ct: res.headers['content-type'] || '', resHeaders: res.headers }));
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
  try { return { type:'JSON', bytes:buf.length, preview:JSON.stringify(JSON.parse(t)).slice(0,300) }; }
  catch { return { type:'TEXT', bytes:buf.length, preview:t.slice(0,300) }; }
}

const RC_POLIZAS = [
  '10-29-2227301',
  '10-29-2227302',
  '10-29-2227303',
];

const baseHeaders = { Authorization: AUTH, codInter: COD, token: TOKEN };

async function try_(label, url, method, headers, body) {
  process.stdout.write(`  [${label}] ${method} ${url.replace(PROD, '')} ... `);
  try {
    const { status, buf, ct, resHeaders } = await rawRequest(url, method, headers, body, 30000);
    const r = classify(buf);
    process.stdout.write(`${status} | ${r.type} ${r.bytes}b | CT:${ct.slice(0,30)}\n`);
    if (r.preview && r.type !== 'PDF') console.log(`    ${r.preview.slice(0,150)}`);
    if ((r.type === 'HTML' && r.bytes > 5000) || r.type === 'PDF') {
      const ext = r.type === 'PDF' ? 'pdf' : 'html';
      const fname = `scripts/caratula_v4_${label.replace(/[^a-z0-9]/gi,'_')}.${ext}`;
      fs.writeFileSync(fname, buf);
      console.log(`    ✅ SAVED: ${fname}`);
      return true;
    }
    return false;
  } catch(e) {
    process.stdout.write(`ERROR: ${e.message}\n`);
    return false;
  }
}

async function main() {
  console.log(`\nPROD: ${PROD}\n`);

  for (const poliza of RC_POLIZAS) {
    const enc = encodeURIComponent(poliza);
    console.log(`\n══ Poliza: ${poliza} ══`);

    // GET with poliza in path
    await try_(`GET_path`, `${PROD}/regional/util/imprimirPoliza/${enc}`, 'GET', baseHeaders, null);
    await try_(`GET_path_cc`, `${PROD}/regional/util/imprimirPoliza/${enc}`, 'GET', { ...baseHeaders, codProv: COD }, null);

    // GET with poliza in query string
    await try_(`GET_query`, `${PROD}/regional/util/imprimirPoliza?poliza=${enc}`, 'GET', baseHeaders, null);
    await try_(`GET_query_numer`, `${PROD}/regional/util/imprimirPoliza?numer=${enc}`, 'GET', baseHeaders, null);
    await try_(`GET_query_numPoliza`, `${PROD}/regional/util/imprimirPoliza?numPoliza=${enc}`, 'GET', baseHeaders, null);

    // Maybe the path structure is different — try /regional/util/{poliza}/imprimir
    await try_(`GET_poliza_in_mid`, `${PROD}/regional/util/${enc}/imprimirPoliza`, 'GET', baseHeaders, null);
    await try_(`GET_numer_param`, `${PROD}/regional/util/imprimirPoliza/${poliza.replace(/-/g,'/')}`, 'GET', baseHeaders, null);
  }

  // Also try PUT (some REST APIs use PUT for "generate document" type operations)
  console.log(`\n══ PUT attempts ══`);
  const poliza = RC_POLIZAS[0];
  await try_(`PUT_body`, `${PROD}/regional/util/imprimirPoliza`, 'PUT', { 'Content-Type':'application/json', ...baseHeaders }, JSON.stringify({ poliza }));
  await try_(`PUT_path`, `${PROD}/regional/util/imprimirPoliza/${encodeURIComponent(poliza)}`, 'PUT', baseHeaders, null);

  // Also check what the OPTIONS response says (shows allowed methods)
  console.log(`\n══ OPTIONS (shows allowed HTTP methods) ══`);
  await try_(`OPTIONS_util`, `${PROD}/regional/util/imprimirPoliza`, 'OPTIONS', baseHeaders, null);
  await try_(`OPTIONS_path`, `${PROD}/regional/util/imprimirPoliza/${encodeURIComponent(poliza)}`, 'OPTIONS', baseHeaders, null);

  console.log('\nDone.\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
