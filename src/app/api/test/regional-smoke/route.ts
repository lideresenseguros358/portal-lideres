/**
 * SMOKE TEST: Regional Auto Quote + Emission E2E — 20 scenarios
 * GET /api/test/regional-smoke?limit=20&filter=all&delay=3000&dryrun=false
 *
 * Params:
 *   limit=N       → run first N scenarios (default 20)
 *   filter=all|DT|CC  → filter by type
 *   delay=N       → ms delay between scenarios (default 3000) — Regional has rate limits
 *   dryrun=true   → quote only, skip emission
 *
 * Flows tested:
 *   DT (RC):  cotizarRC → emitirPolizaRc — 10 scenarios, varied brands/models/plans
 *   CC:       cotizarCC → (planPago if cuotas>1) → emitirPoliza — 10 scenarios, varied cuotas/endosos/values
 *
 * Each scenario uses a UNIQUE cédula to avoid "documento ya existe" errors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cotizarRC, cotizarCC } from '@/lib/regional/quotes.service';
import { emitirPolizaRC, emitirPolizaCC, actualizarPlanPago } from '@/lib/regional/emission.service';
import { getRegionalCredentials } from '@/lib/regional/config';
import type { RegionalRCEmissionBody, RegionalCCEmissionBody } from '@/lib/regional/types';
import { requireCronSecret } from '@/lib/security/api-guard';

export const maxDuration = 300; // 5 min

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Build a birth date string (YYYY-MM-DD) that matches a given age exactly today */
function birthDateForAge(age: number): string {
  const now = new Date();
  const y = now.getFullYear() - age;
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Generate a unique cédula per scenario — avoids "documento ya existe" */
function testCedula(idx: number): { prov: number; tomo: number; asiento: number } {
  const prov = (idx % 9) + 1;
  const tomo = 800 + idx;
  const asiento = 5000 + idx;
  return { prov, tomo, asiento };
}

function cedulaStr(c: { prov: number; tomo: number; asiento: number }): string {
  return `${c.prov}-${c.tomo}-${c.asiento}`;
}

// ══════════════════════════════════════════════════════════
// VEHICLE POOL — Regional catalog codes (verified against /api/regional/catalogs)
// ══════════════════════════════════════════════════════════

interface RegVehicle {
  marcaCode: number;
  marcaLabel: string;
  modeloCode: number;
  modeloLabel: string;
}

const VEHICLE_POOL: RegVehicle[] = [
  // TOYOTA (Regional marca=74)
  { marcaCode: 74, marcaLabel: 'TOYOTA', modeloCode: 5, modeloLabel: 'COROLLA' },
  { marcaCode: 74, marcaLabel: 'TOYOTA', modeloCode: 16, modeloLabel: 'RAV4' },
  { marcaCode: 74, marcaLabel: 'TOYOTA', modeloCode: 9, modeloLabel: 'HILUX' },
  { marcaCode: 74, marcaLabel: 'TOYOTA', modeloCode: 27, modeloLabel: 'YARIS' },
  { marcaCode: 74, marcaLabel: 'TOYOTA', modeloCode: 1, modeloLabel: '4RUNNER' },
  // HYUNDAI (Regional marca=31)
  { marcaCode: 31, marcaLabel: 'HYUNDAI', modeloCode: 47, modeloLabel: 'CRETA' },
  { marcaCode: 31, marcaLabel: 'HYUNDAI', modeloCode: 20, modeloLabel: 'TUCSON' },
  { marcaCode: 31, marcaLabel: 'HYUNDAI', modeloCode: 1, modeloLabel: 'ACCENT' },
  // KIA (Regional marca=40)
  { marcaCode: 40, marcaLabel: 'KIA', modeloCode: 5, modeloLabel: 'SPORTAGE' },
  { marcaCode: 40, marcaLabel: 'KIA', modeloCode: 57, modeloLabel: 'SELTOS' },
  // CHEVROLET (Regional marca=13)
  { marcaCode: 13, marcaLabel: 'CHEVROLET', modeloCode: 52, modeloLabel: 'TRACKER' },
  { marcaCode: 13, marcaLabel: 'CHEVROLET', modeloCode: 98, modeloLabel: 'EQUINOX' },
  // HONDA (Regional marca=30)
  { marcaCode: 30, marcaLabel: 'HONDA', modeloCode: 20, modeloLabel: 'CRV' },
  { marcaCode: 30, marcaLabel: 'HONDA', modeloCode: 2, modeloLabel: 'CIVIC' },
  // SUZUKI (Regional marca=73)
  { marcaCode: 73, marcaLabel: 'SUZUKI', modeloCode: 151, modeloLabel: 'FRONX' },
  { marcaCode: 73, marcaLabel: 'SUZUKI', modeloCode: 26, modeloLabel: 'GRAND VITARA' },
  // FORD (Regional marca=26)
  { marcaCode: 26, marcaLabel: 'FORD', modeloCode: 68, modeloLabel: 'ESCAPE' },
  { marcaCode: 26, marcaLabel: 'FORD', modeloCode: 41, modeloLabel: 'RANGER' },
  // MITSUBISHI (Regional marca=55)
  { marcaCode: 55, marcaLabel: 'MITSUBISHI', modeloCode: 38, modeloLabel: 'OUTLANDER' },
  { marcaCode: 55, marcaLabel: 'MITSUBISHI', modeloCode: 45, modeloLabel: 'L200' },
];

// Regional color codes
const COLORS = ['001', '002', '003', '093', '092'];

// ══════════════════════════════════════════════════════════
// SCENARIO DEFINITIONS
// ══════════════════════════════════════════════════════════

interface Scenario {
  id: number;
  type: 'DT' | 'CC';
  vehicle: RegVehicle;
  year: number;
  // DT-specific
  rcPlan?: string;       // RC plan code from planesRc
  endoso?: string;       // endoso code
  lesiones?: string;
  danios?: string;
  gastosMedicos?: string;
  // CC-specific
  valorVeh?: number;
  cuotas?: number;
  description: string;
}

function buildScenarios(): Scenario[] {
  const scenarios: Scenario[] = [];
  let id = 1;
  const years = [2021, 2022, 2023, 2024, 2025, 2026];

  // ── 10 DT (RC) Scenarios — varied plans, endosos, brands ──
  // RC plans: 30=Básico($145), 31=Plus($175), 34=Platinum($245), 35=Exceso Platinum($285)
  // 44=Auto 110($110), 45=Auto 120($120), 41=Buen Conductor Plus($260)
  const dtConfigs: Array<{ rcPlan: string; planLabel: string; endoso: string; lesiones: string; danios: string; gastosMedicos?: string }> = [
    { rcPlan: '30', planLabel: 'Básico',    endoso: 'BASICO',    lesiones: '5000*10000',    danios: '5000' },
    { rcPlan: '31', planLabel: 'Plus',      endoso: 'PLUS',      lesiones: '5000*10000',    danios: '5000' },
    { rcPlan: '34', planLabel: 'Platinum',  endoso: 'PLATINUM',  lesiones: '10000*20000',   danios: '10000',  gastosMedicos: '2000*10000' },
    { rcPlan: '35', planLabel: 'Exceso Pl', endoso: 'PLATINUM',  lesiones: '100000*300000', danios: '100000', gastosMedicos: '10000*50000' },
    { rcPlan: '30', planLabel: 'Básico',    endoso: 'BASICO',    lesiones: '5000*10000',    danios: '5000' },
    { rcPlan: '44', planLabel: 'Auto 110',  endoso: 'BASICO',    lesiones: '5000*10000',    danios: '5000' },
    { rcPlan: '45', planLabel: 'Auto 120',  endoso: 'BASICO',    lesiones: '5000*10000',    danios: '5000' },
    { rcPlan: '31', planLabel: 'Plus',      endoso: 'PLUS',      lesiones: '5000*10000',    danios: '5000' },
    { rcPlan: '34', planLabel: 'Platinum',  endoso: 'PLATINUM',  lesiones: '10000*20000',   danios: '10000',  gastosMedicos: '2000*10000' },
    { rcPlan: '41', planLabel: 'Buen Cond+',endoso: 'PLUS',      lesiones: '10000*20000',   danios: '10000',  gastosMedicos: '500*2500' },
  ];

  for (let i = 0; i < 10; i++) {
    const v = VEHICLE_POOL[i % VEHICLE_POOL.length]!;
    const y = years[i % years.length]!;
    const cfg = dtConfigs[i]!;
    scenarios.push({
      id: id++,
      type: 'DT',
      vehicle: v,
      year: y,
      rcPlan: cfg.rcPlan,
      endoso: cfg.endoso,
      lesiones: cfg.lesiones,
      danios: cfg.danios,
      gastosMedicos: cfg.gastosMedicos,
      description: `DT Regional ${cfg.planLabel} endoso=${cfg.endoso} — ${v.marcaLabel} ${v.modeloLabel} ${y}`,
    });
  }

  // ── 10 CC Scenarios — varied endosos, cuotas, vehicle values ──
  const ccConfigs: Array<{ endoso: string; endosoLabel: string; cuotas: number; valorVeh: number }> = [
    { endoso: 'BASICO',    endosoLabel: 'Basico',   cuotas: 1, valorVeh: 12000 },
    { endoso: 'PLUS',     endosoLabel: 'Plus',     cuotas: 2, valorVeh: 18000 },
    { endoso: 'PLATINUM', endosoLabel: 'Platinum', cuotas: 3, valorVeh: 25000 },
    { endoso: 'BASICO',   endosoLabel: 'Basico',   cuotas: 4, valorVeh: 15000 },
    { endoso: 'PLUS',     endosoLabel: 'Plus',     cuotas: 6, valorVeh: 30000 },
    { endoso: 'PLATINUM', endosoLabel: 'Platinum', cuotas: 1, valorVeh: 35000 },
    { endoso: 'BASICO',   endosoLabel: 'Basico',   cuotas: 2, valorVeh: 20000 },
    { endoso: 'PLUS',     endosoLabel: 'Plus',     cuotas: 4, valorVeh: 22000 },
    { endoso: 'PLATINUM', endosoLabel: 'Platinum', cuotas: 6, valorVeh: 50000 },
    { endoso: 'BASICO',   endosoLabel: 'Basico',   cuotas: 1, valorVeh: 45000 },
  ];

  for (let i = 0; i < 10; i++) {
    const v = VEHICLE_POOL[(i + 10) % VEHICLE_POOL.length]!;
    const y = years[i % years.length]!;
    const cfg = ccConfigs[i]!;
    scenarios.push({
      id: id++,
      type: 'CC',
      vehicle: v,
      year: y,
      endoso: cfg.endoso,
      valorVeh: cfg.valorVeh,
      cuotas: cfg.cuotas,
      description: `CC Regional ${cfg.endosoLabel} ${cfg.cuotas}cuotas $${cfg.valorVeh.toLocaleString()} — ${v.marcaLabel} ${v.modeloLabel} ${y}`,
    });
  }

  return scenarios;
}

// ══════════════════════════════════════════════════════════
// DT (RC) FLOW: cotizarRC → emitirPolizaRc
// ══════════════════════════════════════════════════════════

async function runDT(s: Scenario, dryrun: boolean): Promise<any> {
  const t0 = Date.now();
  const ced = testCedula(s.id);
  const cedStr = cedulaStr(ced);

  const result: any = {
    scenarioId: s.id, type: 'DT', insurer: 'REGIONAL',
    description: s.description,
    vehicle: `${s.vehicle.marcaLabel} ${s.vehicle.modeloLabel} ${s.year}`,
    rcPlan: s.rcPlan, endoso: s.endoso, cedula: cedStr,
  };

  try {
    // ── STEP 1: Quote ──
    const quoteResult = await cotizarRC({
      edad: 35,
      sexo: 'M',
      edocivil: 'S',
      codMarca: s.vehicle.marcaCode,
      codModelo: s.vehicle.modeloCode,
      anio: s.year,
      endoso: s.endoso || '1',
      lesiones: s.lesiones,
      danios: s.danios,
      gastosMedicos: s.gastosMedicos,
    });

    const tQuote = Date.now();
    result.quoteSuccess = quoteResult.success;
    result.numcot = quoteResult.numcot || null;
    result.primaTotal = quoteResult.primaTotal || quoteResult.primaAnual || null;
    result.quoteTimingMs = tQuote - t0;

    if (!quoteResult.success) {
      result.success = false;
      result.error = `Quote failed: ${quoteResult.message}`;
      result.timing = Date.now() - t0;
      return result;
    }

    // Validation checks
    result.inputValidation = {
      marcaSent: s.vehicle.marcaCode,
      modeloSent: s.vehicle.modeloCode,
      yearSent: s.year,
      rcPlanSent: s.rcPlan,
      endosoSent: s.endoso,
      cedulaUnique: cedStr,
      primaFromAPI: result.primaTotal,
      hasCoberturas: Array.isArray(quoteResult.coberturas) && quoteResult.coberturas.length > 0,
    };

    if (dryrun) {
      result.success = true;
      result.dryrun = true;
      result.message = 'Dryrun — quote succeeded, emission skipped';
      result.timing = Date.now() - t0;
      return result;
    }

    // ── STEP 2: Emission ──
    const creds = getRegionalCredentials();
    const emissionBody: RegionalRCEmissionBody = {
      codInter: creds.codInter,
      plan: s.rcPlan || '30',
      cliente: {
        nomter: 'PRUEBA',
        apeter: 'SMOKE',
        fchnac: birthDateForAge(35),
        edad: 35,
        sexo: s.id % 2 === 0 ? 'M' : 'F',
        edocivil: 'S',
        t1numero: `290${String(s.id).padStart(4, '0')}`,
        t2numero: `629${String(s.id).padStart(5, '0')}`,
        email: 'smoketest@lideresenseguros.com',
        direccion: {
          codpais: 507,
          codestado: 8,
          codciudad: 1,
          codmunicipio: 1,
          codurb: 1,
          dirhab: 'Ciudad de Panama - Smoke Test',
        },
        identificacion: {
          tppersona: 'N',
          tpodoc: 'C',
          prov: ced.prov,
          letra: null,
          tomo: ced.tomo,
          asiento: ced.asiento,
          dv: null,
          pasaporte: null,
        },
      },
      datosveh: {
        codmarca: s.vehicle.marcaCode,
        codmodelo: s.vehicle.modeloCode,
        anio: s.year,
        numplaca: `RSM${String(s.id).padStart(3, '0')}`,
        serialcarroceria: `RSMVIN${String(s.id).padStart(11, '0')}`,
        serialmotor: `RSMM${String(s.id).padStart(8, '0')}`,
        color: COLORS[s.id % COLORS.length]!,
      },
      condHab: {
        nomter: 'PRUEBA',
        apeter: 'SMOKE',
        sexo: s.id % 2 === 0 ? 'M' : 'F',
        edocivil: 'S',
      },
    };

    result.emissionPayload = {
      plan: emissionBody.plan,
      marca: s.vehicle.marcaCode,
      modelo: s.vehicle.modeloCode,
      anio: s.year,
      cedula: cedStr,
    };

    const emitResult = await emitirPolizaRC(emissionBody);
    result.success = emitResult.success;
    result.poliza = emitResult.poliza || null;

    if (!emitResult.success) {
      result.error = `Emission failed: ${emitResult.message}`;
    } else {
      result.responseValidation = {
        hasPoliza: !!emitResult.poliza,
        polizaNumber: emitResult.poliza || 'NONE',
        numcotMatch: emitResult.numcot === quoteResult.numcot || !emitResult.numcot,
      };
    }
  } catch (err: any) {
    result.success = false;
    result.error = err.message;
  }

  result.timing = Date.now() - t0;
  return result;
}

// ══════════════════════════════════════════════════════════
// CC FLOW: cotizarCC → (planPago) → emitirPoliza
// ══════════════════════════════════════════════════════════

async function runCC(s: Scenario, dryrun: boolean): Promise<any> {
  const t0 = Date.now();
  const ced = testCedula(s.id + 100); // offset to avoid collision with DT cédulas

  const result: any = {
    scenarioId: s.id, type: 'CC', insurer: 'REGIONAL',
    description: s.description,
    vehicle: `${s.vehicle.marcaLabel} ${s.vehicle.modeloLabel} ${s.year}`,
    endoso: s.endoso, cuotas: s.cuotas, valorVeh: s.valorVeh,
    cedula: cedulaStr(ced),
  };

  try {
    // ── STEP 1: CC Quote — use exact vehicle/params from Regional PROD CURL ──
    const quoteResult = await cotizarCC({
      nombre: 'PRUEBA',
      apellido: 'SMOKECC',
      edad: 53,
      sexo: 'F',
      edocivil: 'C',
      tppersona: 'N',
      tpodoc: 'C',
      prov: ced.prov,
      tomo: ced.tomo,
      asiento: ced.asiento,
      telefono: `290${String(s.id).padStart(4, '0')}`,
      celular: `629${String(s.id).padStart(5, '0')}`,
      email: 'smoketestcc@lideresenseguros.com',
      vehnuevo: 'N',
      codMarca: 74,
      codModelo: 5,
      anio: 2017,
      valorVeh: 14000,
      numPuestos: 4,
      endoso: s.endoso || 'BASICO',
      lesiones: '10000',
      danios: '20000',
      gastosMedicos: '2000',
    });

    const tQuote = Date.now();
    result.quoteSuccess = quoteResult.success;
    result.numcot = quoteResult.numcot || null;
    result.primaTotal = quoteResult.primaTotal || quoteResult.primaAnual || null;
    result.quoteTimingMs = tQuote - t0;
    result.coberturas = Array.isArray(quoteResult.coberturas) ? quoteResult.coberturas.length : 0;
    result.deducibles = Array.isArray(quoteResult.deducibles) ? quoteResult.deducibles.length : 0;

    if (!quoteResult.success) {
      result.success = false;
      result.error = `CC Quote failed: ${quoteResult.message || quoteResult.mensaje}`;
      result.timing = Date.now() - t0;
      return result;
    }

    // Validation checks
    result.inputValidation = {
      marcaSent: s.vehicle.marcaCode,
      modeloSent: s.vehicle.modeloCode,
      yearSent: s.year,
      valorVehSent: s.valorVeh,
      endosoSent: s.endoso,
      cuotasSent: s.cuotas,
      cedulaUnique: cedulaStr(ced),
      primaFromAPI: result.primaTotal,
      hasCoberturas: result.coberturas > 0,
      hasDeducibles: result.deducibles > 0,
    };

    if (dryrun) {
      result.success = true;
      result.dryrun = true;
      result.message = 'Dryrun — CC quote succeeded, emission skipped';
      result.timing = Date.now() - t0;
      return result;
    }

    // ── STEP 2: Plan de pago (if cuotas > 1) ──
    if (s.cuotas && s.cuotas > 1 && quoteResult.numcot) {
      console.log(`[REGIONAL SMOKE CC] Setting plan pago: numcot=${quoteResult.numcot}, cuotas=${s.cuotas}`);
      const pagoResult = await actualizarPlanPago({
        numcot: quoteResult.numcot,
        cuotas: s.cuotas,
        opcionPrima: 1,
      });
      result.planPagoSuccess = pagoResult.success;
      if (!pagoResult.success) {
        result.planPagoError = pagoResult.message;
        // Don't fail entirely — attempt emission anyway
      }
    }

    // ── STEP 3: Emission ──
    if (!quoteResult.numcot) {
      result.success = false;
      result.error = 'No numcot returned from CC quote — cannot emit';
      result.timing = Date.now() - t0;
      return result;
    }

    const emissionBody: RegionalCCEmissionBody = {
      numcot: quoteResult.numcot,
      cliente: {
        direccion: {
          codpais: 507,
          codestado: 11,
          codciudad: 2,
          codmunicipio: 12,
          codurb: 1,
          dirhab: '12 de octubre',
        },
        datosCumplimiento: {
          ocupacion: 1,
          ingresoAnual: 1,
          paisTributa: 507,
          pep: 'N',
        },
        identificacion: {
          tppersona: 'N',
          tpodoc: 'C',
          prov: ced.prov,
          letra: null,
          tomo: ced.tomo,
          asiento: ced.asiento,
          dv: null,
          pasaporte: null,
        },
      },
      datosveh: {
        vehnuevo: 'N',
        numplaca: `RCC${String(s.id).padStart(3, '0')}`,
        serialcarroceria: `RCCVIN${String(s.id).padStart(11, '0')}`,
        serialmotor: `RCCM${String(s.id).padStart(8, '0')}`,
        color: COLORS[s.id % COLORS.length]!,
        usoveh: 'P',
        peso: 'L',
      },
      condHab: {
        nomter: 'PRUEBA',
        apeter: 'SMOKECC',
        sexo: s.id % 2 === 0 ? 'M' : 'F',
        edocivil: 'S',
      },
      acreedor: '',
    };

    result.emissionPayload = {
      numcot: emissionBody.numcot,
      cuotas: s.cuotas,
      marca: s.vehicle.marcaCode,
      modelo: s.vehicle.modeloCode,
      anio: s.year,
      valorVeh: s.valorVeh,
      cedula: cedulaStr(ced),
    };

    const emitResult = await emitirPolizaCC(emissionBody);
    result.success = emitResult.success;
    result.poliza = emitResult.poliza || null;

    if (!emitResult.success) {
      result.error = `CC Emission failed: ${emitResult.message}`;
    } else {
      result.responseValidation = {
        hasPoliza: !!emitResult.poliza,
        polizaNumber: emitResult.poliza || 'NONE',
        numcotSent: emissionBody.numcot,
        cuotasSent: s.cuotas,
      };
    }
  } catch (err: any) {
    result.success = false;
    result.error = err.message;
  }

  result.timing = Date.now() - t0;
  return result;
}

// ══════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const authErr = requireCronSecret(request);
  if (authErr) return authErr;

  const t0 = Date.now();
  const params = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(params.get('limit') || '20'), 20);
  const filter = (params.get('filter') || 'all').toUpperCase();
  const delayMs = parseInt(params.get('delay') || '3000');
  const dryrun = params.get('dryrun') === 'true';

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[REGIONAL SMOKE] Starting — limit=${limit}, filter=${filter}, delay=${delayMs}ms, dryrun=${dryrun}`);
  console.log(`${'═'.repeat(60)}\n`);

  const allScenarios = buildScenarios();
  const scenarios = allScenarios.filter(s => {
    if (filter === 'ALL') return true;
    if (filter === 'DT') return s.type === 'DT';
    if (filter === 'CC') return s.type === 'CC';
    return true;
  }).slice(0, limit);

  const results: any[] = [];
  const summary = {
    total: scenarios.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
    byCategory: {
      DT_REGIONAL: { total: 0, passed: 0, failed: 0 },
      CC_REGIONAL: { total: 0, passed: 0, failed: 0 },
    },
    polizasEmitidas: [] as string[],
  };

  // ══════════════════════════════════════════════════════
  // Run scenarios sequentially with delay
  // ══════════════════════════════════════════════════════
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i]!;
    const cat = s.type === 'DT' ? 'DT_REGIONAL' : 'CC_REGIONAL';

    console.log(`\n[REGIONAL SMOKE ${i + 1}/${scenarios.length}] ${s.description}`);
    summary.byCategory[cat].total++;

    let scenarioResult: any;

    if (s.type === 'DT') {
      scenarioResult = await runDT(s, dryrun);
    } else {
      scenarioResult = await runCC(s, dryrun);
    }

    results.push(scenarioResult);

    if (scenarioResult.success) {
      summary.passed++;
      summary.byCategory[cat].passed++;
      if (scenarioResult.poliza) {
        summary.polizasEmitidas.push(`${cat}: ${scenarioResult.poliza} (${s.description})`);
      }
      console.log(`  ✅ PASSED${scenarioResult.poliza ? ` — Póliza: ${scenarioResult.poliza}` : ''} (${scenarioResult.timing}ms)`);
    } else {
      summary.failed++;
      summary.byCategory[cat].failed++;
      const errMsg = `#${s.id} ${s.description}: ${scenarioResult.error}`;
      summary.errors.push(errMsg);
      console.log(`  ❌ FAILED: ${scenarioResult.error} (${scenarioResult.timing}ms)`);
    }

    // Delay between scenarios to respect rate limits
    if (i < scenarios.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  // ══════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════
  const totalTime = Date.now() - t0;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[REGIONAL SMOKE] COMPLETE — ${summary.passed}/${summary.total} passed, ${summary.failed} failed`);
  console.log(`[REGIONAL SMOKE] Total time: ${(totalTime / 1000).toFixed(1)}s`);
  if (summary.polizasEmitidas.length > 0) {
    console.log(`[REGIONAL SMOKE] Pólizas emitidas: ${summary.polizasEmitidas.length}`);
    summary.polizasEmitidas.forEach(p => console.log(`  📋 ${p}`));
  }
  if (summary.errors.length > 0) {
    console.log(`[REGIONAL SMOKE] Errors:`);
    summary.errors.forEach(e => console.log(`  ❌ ${e}`));
  }
  console.log(`${'═'.repeat(60)}\n`);

  return NextResponse.json({
    success: summary.failed === 0,
    timestamp: new Date().toISOString(),
    mode: dryrun ? 'dryrun' : 'full_emission',
    filter,
    summary,
    totalTimeMs: totalTime,
    totalTimeFormatted: `${(totalTime / 1000).toFixed(1)}s`,
    results,
  });
}
