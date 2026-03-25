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

function portalGet(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(PORTAL_BASE + path);
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
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
    req.setTimeout(90000, () => req.destroy(new Error(`Portal GET timeout: ${path}`)));
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

// Unique cédula per run
function cedula(idx: number) {
  const prov = (idx % 9) + 1;
  return { prov, tomo: 900 + idx, asiento: 7000 + idx, str: `${(idx % 9) + 1}-${900 + idx}-${7000 + idx}` };
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
    cuotas: 1, acreedor: '81', sinAcreedor: false,
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
    cuotas: 3, acreedor: '', sinAcreedor: true,
    sexo: 'F', edocivil: 'C',
  },
  {
    id: 3,
    label: 'KIA SPORTAGE 2023 — endoso PLATINUM — con acreedor — contado',
    marca: 'KIA', modelo: 'SPORTAGE',
    marcaCode: 40, modeloCode: 5,
    anio: 2023, valorVeh: 25000,
    endoso: 'PLATINUM',
    lesiones: '10000', danios: '20000', gastosMedicos: '2000',
    cuotas: 1, acreedor: '81', sinAcreedor: false,
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

// ── Main ──────────────────────────────────────────────────────

async function main() {
  sep('REGIONAL CC SMOKE TEST — 3 EMISIONES PROD');
  log('CONFIG', `Portal: ${PORTAL_BASE}`);

  const results: any[] = [];
  const summary = {
    total: SCENARIOS.length,
    passed: 0, failed: 0,
    polizas:   [] as string[],
    caratulas: [] as string[],
    errors:    [] as string[],
  };

  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i]!;
    const r = await runScenario(s, i) as any;
    results.push(r);

    if (r.success) {
      summary.passed++;
      if (r.poliza) summary.polizas.push(`S${s.id}: ${r.poliza}  (${s.label})`);
      if (r.pdfPath) summary.caratulas.push(`S${s.id}: ${r.pdfPath}`);
    } else {
      summary.failed++;
      summary.errors.push(`S${s.id} — ${r.error}`);
    }

    if (i < SCENARIOS.length - 1) {
      log('DELAY', 'Waiting 5s...');
      await sleep(5000);
    }
  }

  sep('RESUMEN REGIONAL CC SMOKE TEST — PROD');

  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    console.log(`
  ${icon}  SCENARIO ${r.scenario} — ${r.label}
       Vehículo   : ${r.vehicle}
       Cédula     : ${r.cedula}
       Quote OK   : ${r.quoteSuccess} (numcot=${r.numcot}, prima=${r.primaTotal})
       Emisión OK : ${r.emitSuccess ?? '—'}
       Póliza     : ${r.poliza || 'N/A'}
       Carátula   : ${r.printSuccess ? `✅ ${r.pdfBytes} bytes` : `❌ ${r.printError || '—'}`}
       Error      : ${r.error || '—'}
       Timing     : ${r.timingMs}ms`);
  }

  console.log(`
  ─────────────────────────────────────────────────────────
  RESULTADO    : ${summary.passed}/${summary.total} exitosos

  PÓLIZAS EMITIDAS (${summary.polizas.length}):
${summary.polizas.map(p => `    📋 ${p}`).join('\n') || '    (ninguna)'}

  CARÁTULAS (${summary.caratulas.length}):
${summary.caratulas.map(c => `    📄 ${c}`).join('\n') || '    (ninguna — pendiente en Regional)'}

  ERRORES (${summary.errors.length}):
${summary.errors.map(e => `    ❌ ${e}`).join('\n') || '    (ninguno)'}
  ─────────────────────────────────────────────────────────
`);
}

main().catch(err => {
  console.error('\n[SMOKE] Fatal error:', err);
  process.exit(1);
});
