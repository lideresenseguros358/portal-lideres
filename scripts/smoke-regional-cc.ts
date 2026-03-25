/**
 * smoke-regional-cc.ts
 * ═══════════════════════════════════════════════════════════
 * Regional CC smoke test — 3 emissions against PROD.
 *
 * Calls the DEPLOYED PORTAL API via HTTPS — all Regional
 * traffic proxied through Vercel since port 7443 is blocked locally.
 *
 * Scenarios:
 *   1. TOYOTA COROLLA 2022 — endoso PLUS     — con acreedor  — contado
 *   2. HYUNDAI TUCSON  2021 — endoso BASICO   — sin acreedor — 3 cuotas
 *   3. KIA SPORTAGE   2023 — endoso PLATINUM  — con acreedor — contado
 *
 * Run:
 *   npx tsx scripts/smoke-regional-cc.ts
 * ═══════════════════════════════════════════════════════════
 */

import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import * as https from 'node:https';

// Portal PROD base URL
const PORTAL_BASE = (process.env.PORTAL_BASE ?? 'https://portal.lideresenseguros.com').replace(/\/$/, '');
const CRON_SECRET = process.env.CRON_SECRET ?? 'LISSA-CRON-2026-SECURE-4139947';

// ── HTTP helper (calls portal PROD API) ──────────────────────

function portalPost(path: string, body: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const urlObj = new URL(PORTAL_BASE + path);
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload).toString(),
      },
    };
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
      res.on('error', reject);
    });
    req.setTimeout(90000, () => req.destroy(new Error(`Portal request timeout: ${path}`)));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function portalGet(path: string, extraHeaders?: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(PORTAL_BASE + path);
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: extraHeaders || {},
    };
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        if (ct.includes('application/pdf') || ct.includes('octet-stream')) {
          resolve({ status: res.statusCode, pdf: buf });
        } else {
          const text = buf.toString('utf8');
          try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
          catch { resolve({ status: res.statusCode, body: text }); }
        }
      });
      res.on('error', reject);
    });
    req.setTimeout(300000, () => req.destroy(new Error(`Portal GET timeout: ${path}`)));
    req.on('error', reject);
    req.end();
  });
}

// ── Helpers ──────────────────────────────────────────────────

function log(step: string, msg: string, data?: unknown) {
  const ts = new Date().toISOString().slice(11, 23);
  const extra = data !== undefined ? `\n    ${JSON.stringify(data).slice(0, 600)}` : '';
  console.log(`[${ts}] [${step}] ${msg}${extra}`);
}

function sep(title: string) {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(65));
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Unique cédula per run — use timestamp suffix so repeated runs don't collide in PROD DB
const RUN_SEED = Date.now() % 10000; // last 4 digits of timestamp
function cedula(idx: number) {
  const prov = (idx % 9) + 1;
  const tomo = 100 + idx;
  const asiento = RUN_SEED * 10 + idx;
  return { prov, tomo, asiento, str: `${prov}-${tomo}-${asiento}` };
}

// ── Scenario definitions ──────────────────────────────────────

const SCENARIOS = [
  {
    id: 1,
    label: 'TOYOTA COROLLA 2022 — endoso PLUS — con acreedor — contado',
    marca: 'TOYOTA', modelo: 'COROLLA',
    // Regional catalog codes (verified)
    marcaCode: 74, modeloCode: 5,
    anio: 2022, valorVeh: 18000,
    endoso: 'PLUS',
    lesiones: '10000', danios: '20000', gastosMedicos: '2000',
    cuotas: 1, acreedor: '', sinAcreedor: true,
    sexo: 'M', edocivil: 'S',
  },
  {
    id: 2,
    label: 'HYUNDAI TUCSON 2021 — endoso BASICO — sin acreedor — 3 cuotas',
    marca: 'HYUNDAI', modelo: 'TUCSON',
    marcaCode: 31, modeloCode: 20,
    anio: 2021, valorVeh: 14000,
    endoso: 'BASICO',
    lesiones: '10000', danios: '20000', gastosMedicos: '2000',
    cuotas: 3, acreedor: '', sinAcreedor: true,  // sin acreedor (explicit)
    sexo: 'F', edocivil: 'C',
  },
  {
    id: 3,
    label: 'KIA SPORTAGE 2023 — endoso PLATINUM — sin acreedor — contado',
    marca: 'KIA', modelo: 'SPORTAGE',
    marcaCode: 40, modeloCode: 5,
    anio: 2023, valorVeh: 25000,
    endoso: 'PLATINUM',
    lesiones: '10000', danios: '20000', gastosMedicos: '2000',
    cuotas: 1, acreedor: '', sinAcreedor: true,
    sexo: 'M', edocivil: 'S',
  },
];

// ── Run one scenario ──────────────────────────────────────────

async function runScenario(s: typeof SCENARIOS[number], idx: number) {
  sep(`SCENARIO ${s.id}/3 — ${s.label}`);
  const ced = cedula(idx + 60);
  const result: Record<string, unknown> = {
    scenario: s.id, label: s.label,
    vehicle: `${s.marca} ${s.modelo} ${s.anio}`,
    cedula: ced.str,
  };
  const t0 = Date.now();

  // ── Step 1: Quote CC ───────────────────────────────────────
  log(`S${s.id}/QUOTE`, `POST /api/regional/auto/quote-cc  endoso=${s.endoso} valor=${s.valorVeh} marca=${s.marcaCode} modelo=${s.modeloCode}`);
  const quotePayload = {
    nombre: 'SMOKE', apellido: 'REGIONAL',
    edad: '35', sexo: s.sexo, edocivil: s.edocivil,
    tppersona: 'N', tpodoc: 'C',
    prov: String(ced.prov), tomo: String(ced.tomo), asiento: String(ced.asiento),
    telefono: `290${String(s.id).padStart(4,'0')}`,
    celular:  `629${String(s.id).padStart(5,'0')}`,
    email: 'smoketestcc@lideresenseguros.com',
    vehnuevo: 'N',
    codMarca:  String(s.marcaCode),
    codModelo: String(s.modeloCode),
    marca: s.marca,
    modelo: s.modelo,
    anio: String(s.anio),
    valorVeh: String(s.valorVeh),
    numPuestos: '5',
    endoso: s.endoso,
    lesiones: s.lesiones,
    danios: s.danios,
    gastosMedicos: s.gastosMedicos,
  };

  const quoteRes = await portalPost('/api/regional/auto/quote-cc', quotePayload);
  log(`S${s.id}/QUOTE`, `Status=${quoteRes.status}`, quoteRes.body);

  const qb = quoteRes.body;
  result.quoteStatus = quoteRes.status;
  result.quoteSuccess = qb?.success === true;
  result.numcot = qb?.numcot ?? null;
  result.primaTotal = qb?.primaTotal ?? qb?.primatotal ?? null;
  result.quoteError = qb?.success ? null : (qb?.error || qb?.message || 'unknown');

  if (!result.quoteSuccess || !result.numcot) {
    result.success = false;
    result.error = `Quote failed: ${result.quoteError}`;
    result.timingMs = Date.now() - t0;
    log(`S${s.id}/QUOTE`, `❌ FAILED — ${result.error}`);
    return result;
  }
  log(`S${s.id}/QUOTE`, `✅ numcot=${result.numcot} prima=${result.primaTotal}`);

  // ── Step 2: Emit CC ────────────────────────────────────────
  log(`S${s.id}/EMIT`, `POST /api/regional/auto/emit-cc  numcot=${result.numcot} cuotas=${s.cuotas} acreedor=${s.acreedor || '(sin)'}`);
  const emitPayload = {
    numcot:       result.numcot,
    cuotas:       s.cuotas,
    opcionPrima:  1,
    // direccion
    codpais:      507,
    codestado:    8,
    codciudad:    1,
    codmunicipio: 1,
    codurb:       1,
    dirhab:       'Ciudad de Panama - Smoke CC',
    // cumplimiento
    ocupacion:    1,
    ingresoAnual: 2,
    paisTributa:  507,
    pep:          'N',
    // vehículo
    vehnuevo:    'N',
    placa:       `RCC${String(s.id + idx * 10).padStart(3,'0')}`,
    chasis:      `RCCVIN${String(s.id * 100 + idx * 10).padStart(11,'0')}`,
    motor:       `RCCM${String(s.id * 100 + idx * 10).padStart(8,'0')}`,
    color:       'BLANCO',
    usoveh:      'P',
    peso:        'L',
    // acreedor
    acreedor:    s.sinAcreedor ? '' : (s.acreedor || '81'),
  };

  const emitRes = await portalPost('/api/regional/auto/emit-cc', emitPayload);
  log(`S${s.id}/EMIT`, `Status=${emitRes.status}`, emitRes.body);

  const eb = emitRes.body;
  result.emitStatus  = emitRes.status;
  result.emitSuccess = eb?.success === true;
  result.poliza      = eb?.poliza ?? eb?.numpoliza ?? null;
  result.emitError   = eb?.success ? null : (eb?.error || eb?.message || 'unknown');

  if (!result.emitSuccess) {
    result.success = false;
    result.error = `Emission failed: ${result.emitError}`;
    result.timingMs = Date.now() - t0;
    log(`S${s.id}/EMIT`, `❌ FAILED — ${result.emitError}`);
    return result;
  }
  log(`S${s.id}/EMIT`, `✅ Póliza emitida: ${result.poliza}`);

  // ── Step 3: Imprimir (carátula) ────────────────────────────
  if (result.poliza) {
    log(`S${s.id}/PDF`, `GET /api/regional/auto/print?poliza=${result.poliza}`);
    try {
      const pdfRes = await portalGet(`/api/regional/auto/print?poliza=${encodeURIComponent(String(result.poliza))}`);
      if (pdfRes.pdf && pdfRes.pdf.length > 100) {
        const outPath = nodePath.join(process.cwd(), 'scripts', `caratula_cc_s${s.id}_${String(result.poliza).replace(/[/\\]/g,'-')}.pdf`);
        fs.writeFileSync(outPath, pdfRes.pdf);
        result.printSuccess = true;
        result.pdfBytes     = pdfRes.pdf.length;
        result.pdfPath      = outPath;
        log(`S${s.id}/PDF`, `✅ Carátula: ${outPath} (${pdfRes.pdf.length} bytes)`);
      } else {
        result.printSuccess = false;
        result.printError   = pdfRes.body?.error || pdfRes.body?.message || `status ${pdfRes.status}`;
        log(`S${s.id}/PDF`, `⚠️  Carátula no disponible: ${result.printError}`);
      }
    } catch (e: any) {
      result.printSuccess = false;
      result.printError   = e.message;
      log(`S${s.id}/PDF`, `⚠️  Print request error: ${e.message}`);
    }
  }

  result.success  = true;
  result.timingMs = Date.now() - t0;
  return result;
}

// ── Main — calls /api/test/regional-smoke (Vercel, PROD env, avoids vehicle mapper) ──

async function main() {
  sep('REGIONAL CC SMOKE TEST — 3 EMISIONES PROD via Vercel');
  log('CONFIG', `Portal: ${PORTAL_BASE}`);

  const smokeUrl = `/api/test/regional-smoke?filter=CC&limit=3&delay=4000&dryrun=false`;
  log('REQUEST', `GET ${smokeUrl}`);
  console.log('\n⏳ Running 3 CC emissions via portal smoke endpoint (may take 2-3 min)...\n');

  const res = await portalGet(smokeUrl, { Authorization: `Bearer ${CRON_SECRET}` });
  log('RESPONSE', `Status: ${res.status}`);

  if (!res.body || res.status !== 200) {
    console.error('❌ Smoke endpoint failed:', res.status, JSON.stringify(res.body ?? res).slice(0, 800));
    process.exit(1);
  }

  const data = res.body as any;
  const results: any[] = data.results || [];
  const summary = data.summary || {};

  sep('RESUMEN REGIONAL CC SMOKE TEST — PROD');

  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    console.log(`
  ${icon}  Scenario ${r.scenarioId} — ${r.description}
       Vehículo   : ${r.vehicle}
       Quote OK   : ${r.quoteSuccess} (numcot=${r.numcot}, prima=${r.primaTotal})
       Emisión OK : ${r.success ? 'sí' : (r.error ? 'no' : '—')}
       Póliza     : ${r.poliza || 'N/A'}
       Error      : ${r.error || '—'}
       Timing     : ${r.timing}ms`);
  }

  const polizas = summary.polizasEmitidas || [];
  console.log(`
  ─────────────────────────────────────────────────────────
  RESULTADO    : ${summary.passed}/${summary.total} exitosos

  PÓLIZAS EMITIDAS (${polizas.length}):
${polizas.map((p: string) => `    📋 ${p}`).join('\n') || '    (ninguna)'}

  ERRORES (${(summary.errors || []).length}):
${(summary.errors || []).map((e: string) => `    ❌ ${e}`).join('\n') || '    (ninguno)'}

  Tiempo total : ${data.totalTimeFormatted || '—'}
  ─────────────────────────────────────────────────────────
`);
}

main().catch(err => {
  console.error('\n[SMOKE] Fatal error:', err);
  process.exit(1);
});
