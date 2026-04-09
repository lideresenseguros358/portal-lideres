/**
 * smoke-regional-print3.mjs
 * ═══════════════════════════════════════════════════════════
 * Targeted investigation:
 *  1. Test older RC policies (15-30 min old) — async generation?
 *  2. Try additional body fields (codInter, tipo, tipoCobertura)
 *  3. Try poliza with -0 suffix
 *  4. Scan DESA for correct credentials via different auth methods
 * ═══════════════════════════════════════════════════════════
 */
import https from 'node:https';
import http from 'node:http';
import { URL as NodeURL } from 'node:url';
import * as fs from 'node:fs';

const PROD = (process.env.REGIONAL_BASE_URL_PROD || '').trim().replace(/\/$/, '');
const DESA = (process.env.REGIONAL_BASE_URL_DESA || '').trim().replace(/\/$/, '');
const COD   = (process.env.REGIONAL_COD_INTER_PROD || '99').trim();
const TOKEN = (process.env.REGIONAL_TOKEN_PROD || '').trim();
const USER  = (process.env.REGIONAL_USERNAME_PROD || '').trim();
const PASS  = (process.env.REGIONAL_PASSWORD_PROD || '').trim();
const AUTH  = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;

const DESA_COD   = (process.env.REGIONAL_COD_INTER_DESA || '99').trim();
const DESA_TOKEN = (process.env.REGIONAL_TOKEN_DESA || '').trim();
const DESA_USER  = (process.env.REGIONAL_USERNAME_DESA || '').trim();
const DESA_PASS  = (process.env.REGIONAL_PASSWORD_DESA || '').trim();
const DESA_AUTH  = `Basic ${Buffer.from(`${DESA_USER}:${DESA_PASS}`).toString('base64')}`;

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
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks), ct: res.headers['content-type'] || '' }));
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
  try { const j = JSON.parse(t); return { type:'JSON', bytes:buf.length, preview:JSON.stringify(j).slice(0,200), parsed:j }; }
  catch { return { type:'TEXT', bytes:buf.length, preview:t.slice(0,200) }; }
}

async function tryPrint(label, baseUrl, path, headers, body) {
  const url = `${baseUrl}${path}`;
  process.stdout.write(`  [${label}] POST ${path}  body=${JSON.stringify(body).slice(0,80)} ... `);
  try {
    const { status, buf, ct } = await rawRequest(url, 'POST', headers, JSON.stringify(body), 30000);
    const r = classify(buf);
    process.stdout.write(`${status} ${r.type} ${r.bytes}b\n`);
    if (r.type === 'HTML' && r.bytes > 1000) {
      const fname = `scripts/caratula_${label.replace(/[^a-z0-9]/gi,'_')}.html`;
      fs.writeFileSync(fname, buf);
      console.log(`    ✅ Saved: ${fname}`);
      return true;
    }
    if (r.type === 'PDF') {
      const fname = `scripts/caratula_${label.replace(/[^a-z0-9]/gi,'_')}.pdf`;
      fs.writeFileSync(fname, buf);
      console.log(`    ✅ Saved: ${fname}`);
      return true;
    }
    if (r.preview && r.preview !== '{}') console.log(`    Preview: ${r.preview.slice(0,120)}`);
    return false;
  } catch(e) {
    process.stdout.write(`ERROR: ${e.message}\n`);
    return false;
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  REGIONAL PRINT INVESTIGATION v3');
  console.log(`  PROD: ${PROD}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Policies emitted during this session (oldest first)
  const rcPolizas = [
    '10-29-2227301',  // first smoke test (~30 min ago)
    '10-29-2227302',  // second test (~20 min ago)
    '10-29-2190735',  // DESA poliza
  ];

  const stdHeaders = { 'Content-Type':'application/json', Authorization:AUTH, codInter:COD, token:TOKEN };
  const withProv   = { ...stdHeaders, codProv:COD };

  // ── 1. Test aged PROD policies (maybe async generation) ──────
  console.log('─── 1. Aged PROD policies — maybe carátula ready now? ──────');
  for (const poliza of rcPolizas.slice(0,2)) {
    const found = await tryPrint(`aged_${poliza}`, PROD, '/regional/util/imprimirPoliza', stdHeaders, { poliza });
    if (found) { console.log(`\n🎉 ASYNC CONFIRMED: poliza ${poliza} now has a carátula!\n`); break; }
  }

  // ── 2. Different body variations ─────────────────────────────
  console.log('\n─── 2. Body field variations ───────────────────────────────');
  const testPoliza = '10-29-2227301';
  const bodyVariants = [
    { poliza: testPoliza },
    { poliza: testPoliza, codInter: COD },
    { poliza: testPoliza, codInter: parseInt(COD) },
    { poliza: testPoliza, tipo: 'RC' },
    { poliza: testPoliza, tipo: 'DT' },
    { poliza: testPoliza, tipoCobertura: 'RC' },
    { poliza: testPoliza, tipoCobertura: 'DT' },
    { poliza: testPoliza, ramo: 'AUTO' },
    { poliza: `${testPoliza}-0` },           // with -0 suffix
    { poliza: testPoliza.replace('10-29-', '') }, // just the number part
    { nroPoliza: testPoliza },               // different field name
    { numPoliza: testPoliza },
    { numero: testPoliza },
  ];

  for (const body of bodyVariants) {
    const label = `body_${JSON.stringify(body).replace(/[^a-z0-9]/gi,'_').slice(0,30)}`;
    const found = await tryPrint(label, PROD, '/regional/util/imprimirPoliza', stdHeaders, body);
    if (found) { console.log(`\n🎉 BODY VARIANT WORKED: ${JSON.stringify(body)}\n`); break; }
    // Small pause to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  // ── 3. Headers with codProv for RC ───────────────────────────
  console.log('\n─── 3. Header with codProv (CC-style) for RC policy ────────');
  await tryPrint('RC_withCodProv', PROD, '/regional/util/imprimirPoliza', withProv, { poliza: testPoliza });
  await tryPrint('RC_withCodProvBody', PROD, '/regional/util/imprimirPoliza', withProv, { poliza: testPoliza, codInter: COD });

  // ── 4. GET method (maybe it's a GET not POST) ─────────────────
  console.log('\n─── 4. GET method / query param ────────────────────────────');
  try {
    const url = `${PROD}/regional/util/imprimirPoliza?poliza=${encodeURIComponent(testPoliza)}`;
    process.stdout.write(`  GET ${url.slice(0,80)}... `);
    const { status, buf } = await rawRequest(url, 'GET', stdHeaders, null, 15000);
    const r = classify(buf);
    process.stdout.write(`${status} ${r.type} ${r.bytes}b\n`);
    if (r.preview) console.log(`  Preview: ${r.preview.slice(0,120)}`);
  } catch(e) { console.log(`  GET error: ${e.message}`); }

  // ── 5. Different URL formats ──────────────────────────────────
  console.log('\n─── 5. Alternative URL formats ─────────────────────────────');
  const altPaths = [
    '/regional/util/imprimirPoliza',
    '/regional/util/imprimir',
    '/regional/util/imprimir/poliza',
    '/regional/util/print',
    '/regional/auto/imprimir',
    `/regional/util/imprimirPoliza/${encodeURIComponent(testPoliza)}`,
    `/regional/auto/imprimirPoliza/${encodeURIComponent(testPoliza)}`,
  ];
  for (const path of altPaths) {
    await tryPrint(`path_${path.replace(/\//g,'_')}`, PROD, path, stdHeaders, { poliza: testPoliza });
    await new Promise(r => setTimeout(r, 150));
  }

  // ── 6. DESA with fresh poliza ─────────────────────────────────
  console.log('\n─── 6. DESA — emit fresh RC + immediate print ───────────────');
  const seed = Date.now() % 100000;
  const rcBody = {
    codInter: DESA_COD,
    plan: '30',
    cliente: {
      nomter:'SMOKE3', apeter:'TEST3', fchnac:'1990-04-08', edad:36, sexo:'M', edocivil:'S',
      t1numero:'2900000', t2numero:'62900000', email:'test@test.com',
      direccion:{codpais:507,codestado:8,codciudad:1,codmunicipio:1,codurb:1,dirhab:'Ciudad Panama'},
      identificacion:{tppersona:'N',tpodoc:'C',prov:8,letra:null,tomo:500+(seed%400),asiento:seed,dv:null,pasaporte:null},
    },
    datosveh:{codmarca:74,codmodelo:5,anio:2020,numplaca:`DS3${String(seed).slice(-4)}`,
      serialcarroceria:`DSV3${String(seed).padStart(8,'0')}`,serialmotor:`DSM3${String(seed).padStart(8,'0')}`,color:'001'},
    condHab:{nomter:'SMOKE3',apeter:'TEST3',sexo:'M',edocivil:'S'},
  };
  const desaRcHeaders = { 'Content-Type':'application/json', Authorization:DESA_AUTH, codInter:DESA_COD, token:DESA_TOKEN };

  process.stdout.write('  DESA emit RC... ');
  try {
    const { status, buf } = await rawRequest(`${DESA}/regional/auto/emitirPolizaRc`, 'POST', desaRcHeaders, JSON.stringify(rcBody), 60000);
    const r = classify(buf);
    process.stdout.write(`${status} ${r.type} ${r.bytes}b\n`);
    if (r.parsed?.poliza) {
      const desaPoliza = r.parsed.poliza;
      console.log(`  DESA póliza: ${desaPoliza}`);

      // Try immediately
      await tryPrint(`DESA_imm`, DESA, '/regional/util/imprimirPoliza', desaRcHeaders, { poliza: desaPoliza });
      // Wait 5s
      console.log('  Waiting 5s...');
      await new Promise(r => setTimeout(r, 5000));
      await tryPrint(`DESA_5s`, DESA, '/regional/util/imprimirPoliza', desaRcHeaders, { poliza: desaPoliza });
    } else {
      console.log(`  DESA emit failed: ${r.preview}`);
    }
  } catch(e) { console.log(`  DESA emit error: ${e.message}`); }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
