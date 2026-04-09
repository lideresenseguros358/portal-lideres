/**
 * smoke-regional-cc-print.mjs
 * ═══════════════════════════════════════════════════════════
 * Test imprimirPoliza for a freshly emitted CC policy on PROD.
 * This confirms whether the endpoint works at all for our account,
 * or if {} is returned for all policy types.
 *
 * Run:
 *   node --env-file=.env.local scripts/smoke-regional-cc-print.mjs
 * ═══════════════════════════════════════════════════════════
 */

import https from 'node:https';
import http from 'node:http';
import { URL as NodeURL } from 'node:url';
import * as fs from 'node:fs';

const BASE  = (process.env.REGIONAL_BASE_URL_PROD || '').trim().replace(/\/$/, '');
const USER  = (process.env.REGIONAL_USERNAME_PROD || '').trim();
const PASS  = (process.env.REGIONAL_PASSWORD_PROD || '').trim();
const COD   = (process.env.REGIONAL_COD_INTER_PROD || '99').trim();
const TOKEN = (process.env.REGIONAL_TOKEN_PROD || '').trim();
const AUTH  = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;

console.log(`Base: ${BASE}`);

function rawRequest(url, method, headers, body, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const parsed = new NodeURL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const bodyBuf = body ? Buffer.from(body, 'utf8') : Buffer.alloc(0);
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method,
      headers: { ...headers, 'Content-Length': bodyBuf.length.toString() },
      rejectUnauthorized: false,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks), ct: res.headers['content-type'] || '' }));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout`)));
    req.on('error', reject);
    if (bodyBuf.length) req.write(bodyBuf);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function classify(buf) {
  const t = buf.toString('utf8');
  const trimmed = t.trimStart();
  if (buf.slice(0,5).toString('ascii') === '%PDF-') return { type: 'PDF', bytes: buf.length };
  if (trimmed.startsWith('<!') || /^<html/i.test(trimmed)) return { type: 'HTML', bytes: buf.length, preview: trimmed.slice(0,80) };
  try { return { type: 'JSON', bytes: buf.length, preview: JSON.stringify(JSON.parse(t)).slice(0,300), parsed: JSON.parse(t) }; }
  catch { return { type: 'TEXT', bytes: buf.length, preview: t.slice(0,200) }; }
}

async function post(path, headers, body) {
  const url = `${BASE}${path}`;
  console.log(`  POST ${path}`);
  const { status, buf, ct } = await rawRequest(url, 'POST', headers, JSON.stringify(body));
  const r = classify(buf);
  console.log(`  Status: ${status} | CT: ${ct} | Type: ${r.type} | Bytes: ${r.bytes}`);
  if (r.preview) console.log(`  Preview: ${r.preview.slice(0,150)}`);
  return { status, r };
}

async function main() {
  const seed = Date.now() % 100000;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  CC EMIT + PRINT TEST — PROD');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 1: CC Cotización (uses same TOKEN as cotizar token)
  console.log('─── 1. CC Cotización ────────────────────────────────────────');
  const quoteHeaders = { 'Content-Type': 'application/json', Authorization: AUTH, codInter: COD, token: TOKEN };
  const quoteBody = {
    codInter: COD,
    cliente: {
      nomter: 'SMOKE', apeter: 'CC PRINT',
      fchnac: '1990-04-08', edad: 36, sexo: 'M', edocivil: 'S',
      t1numero: '2900000', t2numero: '62900000',
      email: 'smoke@lideresenseguros.com',
      direccion: { codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1, dirhab: 'Ciudad de Panama' },
      identificacion: { tppersona: 'N', tpodoc: 'C', prov: 8, letra: null, tomo: 300 + (seed % 700), asiento: seed, dv: null, pasaporte: null },
      datosCumplimiento: { ocupacion: 1, ingresoAnual: 2, paisTributa: 507, pep: 'N' },
    },
    datosveh: {
      codmarca: 74, codmodelo: 5, anio: 2021,
      vehnuevo: 'N', numPuestos: 5,
      nMontoVeh: 15000, nLesiones: 10000, nDanios: 20000, nGastosMed: 2000,
      cEndoso: 'BASICO', cTipoCobert: 'CC',
      numplaca: `SCC${String(seed).slice(-4)}`,
      serialcarroceria: `CCVN${String(seed).padStart(8,'0')}`,
      serialmotor: `CCMT${String(seed).padStart(8,'0')}`,
      color: '001', usoveh: 'P', peso: 'L',
    },
    acreedor: '81',
  };

  const { r: quoteR } = await post('/regional/auto/cotizacion', quoteHeaders, quoteBody);
  if (quoteR.type !== 'JSON' || !quoteR.parsed?.numcot) {
    console.log('❌ Cotización failed — cannot proceed');
    // Try with alternate CC-style headers (codProv)
    console.log('\nRetrying with codProv header...');
    const headersCC = { 'Content-Type': 'application/json', Authorization: AUTH, codInter: COD, codProv: COD, token: TOKEN };
    const { r: r2 } = await post('/regional/auto/cotizacion', headersCC, quoteBody);
    if (r2.type !== 'JSON' || !r2.parsed?.numcot) {
      console.log('❌ Cotización also failed with codProv');
      process.exit(1);
    }
  }

  const numcot = quoteR.parsed?.numcot;
  console.log(`  ✅ numcot: ${numcot}`);

  // Step 2: CC Emission
  console.log('\n─── 2. CC Emission ──────────────────────────────────────────');
  const emitHeaders = { 'Content-Type': 'application/json', Authorization: AUTH, codInter: COD, codProv: COD, token: TOKEN };
  const emitBody = {
    codInter: COD,
    numcot,
    cliente: {
      direccion: { codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1, dirhab: 'Ciudad de Panama' },
      datosCumplimiento: { ocupacion: 1, ingresoAnual: 2, paisTributa: 507, pep: 'N' },
    },
    datosveh: {
      vehnuevo: 'N',
      numplaca: `SCC${String(seed).slice(-4)}`,
      serialcarroceria: `CCVN${String(seed).padStart(8,'0')}`,
      serialmotor: `CCMT${String(seed).padStart(8,'0')}`,
      color: '001', usoveh: 'P', peso: 'L',
    },
    acreedor: '81',
  };

  const { r: emitR } = await post('/regional/auto/emitirPoliza', emitHeaders, emitBody);
  const ccPoliza = emitR.parsed?.poliza || emitR.parsed?.numpoliza;
  if (!ccPoliza) {
    console.log('❌ CC emission failed');
    process.exit(1);
  }
  console.log(`  ✅ CC Póliza: ${ccPoliza}`);

  // Step 3: imprimirPoliza for CC policy
  console.log('\n─── 3. imprimirPoliza for CC policy ─────────────────────────');

  const cleanCCPoliza = ccPoliza.replace(/-0$/, '');
  console.log(`  Using poliza: ${cleanCCPoliza} (stripped from ${ccPoliza})`);

  for (const [label, delayMs, headers] of [
    ['CC/camelCase/0ms',    0,    { 'Content-Type': 'application/json', Authorization: AUTH, codInter: COD, codProv: COD, token: TOKEN }],
    ['CC/camelCase/300ms',  300,  { 'Content-Type': 'application/json', Authorization: AUTH, codInter: COD, codProv: COD, token: TOKEN }],
    ['CC/noCodProv/0ms',    0,    { 'Content-Type': 'application/json', Authorization: AUTH, codInter: COD, token: TOKEN }],
  ]) {
    if (delayMs) { console.log(`  Waiting ${delayMs}ms...`); await sleep(delayMs); }
    console.log(`\n  [${label}]`);
    const { status, buf, ct } = await rawRequest(
      `${BASE}/regional/util/imprimirPoliza`,
      'POST',
      headers,
      JSON.stringify({ poliza: cleanCCPoliza }),
      30000
    );
    const r = classify(buf);
    console.log(`  Status: ${status} | CT: ${ct} | Type: ${r.type} | Bytes: ${r.bytes}`);
    if (r.preview) console.log(`  Preview: ${r.preview.slice(0,120)}`);

    if (r.type === 'HTML' && r.bytes > 1000) {
      const path = `scripts/caratula_cc_${label.replace(/\//g,'_')}.html`;
      fs.writeFileSync(path, buf);
      console.log(`  ✅ CC HTML saved: ${path}`);
      break;
    }
    if (r.type === 'PDF') {
      const path = `scripts/caratula_cc_${label.replace(/\//g,'_')}.pdf`;
      fs.writeFileSync(path, buf);
      console.log(`  ✅ CC PDF saved: ${path}`);
      break;
    }
  }

  // Now test imprimirPoliza with the SAME headers for an RC policy
  console.log('\n─── 4. Same headers → RC policy ─────────────────────────────');
  console.log('  (Using headers that work for CC — does it work for RC too?)');

  const rcPolizaTest = '10-29-2227302'; // from previous test
  for (const [label, headers] of [
    ['RC/withCodProv',  { 'Content-Type': 'application/json', Authorization: AUTH, codInter: COD, codProv: COD, token: TOKEN }],
    ['RC/withoutCodProv', { 'Content-Type': 'application/json', Authorization: AUTH, codInter: COD, token: TOKEN }],
  ]) {
    console.log(`\n  [${label}]`);
    const { status, buf, ct } = await rawRequest(
      `${BASE}/regional/util/imprimirPoliza`, 'POST', headers,
      JSON.stringify({ poliza: rcPolizaTest }), 30000
    );
    const r = classify(buf);
    console.log(`  Status: ${status} | CT: ${ct} | Type: ${r.type} | Bytes: ${r.bytes}`);
    if (r.preview) console.log(`  Preview: ${r.preview.slice(0,120)}`);
    if (r.type === 'HTML' && r.bytes > 1000) {
      const path = `scripts/caratula_rc_recovered.html`;
      fs.writeFileSync(path, buf);
      console.log(`  ✅ RC HTML saved: ${path}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  DONE');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
