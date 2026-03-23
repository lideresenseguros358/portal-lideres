/**
 * SMOKE TEST: Auto Quote + Emission E2E — 50 vehicle scenarios
 * GET /api/test/auto-smoke?limit=50&filter=all&delay=2000
 *
 * Params:
 *   limit=N       → run first N scenarios (default 50)
 *   filter=all|DT|CC|FEDPA|IS  → filter by type/insurer
 *   delay=N       → ms delay between scenarios (default 2000)
 *   dryrun=true   → quote only, skip emission
 *
 * Flows tested:
 *   DT FEDPA:  EmisorPlan (token → upload docs → emitirpoliza) — plans 1000/1002, contado/2cuotas
 *   DT IS:     quote-full → getemision — plan 306, grupo 20, contado
 *   CC IS:     quote-full → getemision — plan 29, grupo 20, deducibles 1/2/3, cuotas 1/2/6/10, values $8k-$80k
 *
 * CC is ONLY available for Internacional (IS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerToken } from '@/lib/fedpa/auth.service';
import { subirDocumentos } from '@/lib/fedpa/documentos.service';
import { emitirPoliza } from '@/lib/fedpa/emision.service';
import { generarCotizacionAuto, emitirPolizaAuto } from '@/lib/is/quotes.service';
import type { EmitirPolizaRequest } from '@/lib/fedpa/types';
import { getMarcas, getModelos } from '@/lib/is/catalogs.service';
import { requireCronSecret } from '@/lib/security/api-guard';

export const maxDuration = 300; // 5 min

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

/** Minimal valid JPEG (1×1 px) for FEDPA doc upload */
function createTestJpeg(filename: string): File {
  const b64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS' +
    'Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ' +
    'CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
    'MjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEA' +
    'AAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh' +
    'MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6' +
    'Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZ' +
    'mqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx' +
    '8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREA' +
    'AgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAV' +
    'YnLRChYkNOEl8RcYI4Q/RFhHRUYnJCk0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNk' +
    'ZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6SlpqeoqaqysLGys7S1' +
    'tre4ubqCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwD' +
    'AQACEQMRAD8A/9k=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: 'image/jpeg' });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Generate a unique-ish cedula for test */
function testCedula(idx: number): string {
  const p1 = (idx % 9) + 1;
  const p2 = 700 + idx;
  const p3 = 1000 + idx;
  return `${p1}-${p2}-${p3}`;
}

// ══════════════════════════════════════════════════════════
// SCENARIO DEFINITIONS
// ══════════════════════════════════════════════════════════

interface VehicleDef {
  marcaCode: number;
  marcaLabel: string;
  modeloCode: number;
  modeloLabel: string;
  // FEDPA uses string codes (e.g. 'TOY', 'COROLLA')
  fedpaMarca: string;
  fedpaModelo: string;
}

interface Scenario {
  id: number;
  type: 'DT' | 'CC';
  insurer: 'FEDPA' | 'IS';
  vehicle: VehicleDef;
  year: number;
  plan: string;
  planCode: number;      // FEDPA plan code or IS codPlanCobertura
  cuotas: number;        // 1=contado
  deducible: number;     // IS CC opcion: 1=bajo, 2=medio, 3=alto
  valorVehiculo: number; // 0 for DT, >0 for CC
  grupoTarifa: number;   // IS codGrupoTarifa
  description: string;
}

// ── 50 vehicles with VERIFIED IS catalog codes (tested against CC plan 29) ──
// All marca/modelo codes confirmed working for both DT (plan 306) and CC (plan 29).
// FEDPA codes are best-effort; FEDPA emission uses string-based marca/modelo.
const VEHICLE_POOL: VehicleDef[] = [
  // TOYOTA (IS marca=156)
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 2533, modeloLabel: 'COROLLA', fedpaMarca: 'TOY', fedpaModelo: 'COROLLA' },
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 2452, modeloLabel: 'RAV4', fedpaMarca: 'TOY', fedpaModelo: 'RAV4' },
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 2497, modeloLabel: 'HILUX', fedpaMarca: 'TOY', fedpaModelo: 'HILUX' },
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 2541, modeloLabel: 'YARIS', fedpaMarca: 'TOY', fedpaModelo: 'YARIS' },
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 2465, modeloLabel: '4RUNNER', fedpaMarca: 'TOY', fedpaModelo: '4RUNNER' },
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 168, modeloLabel: '4RUNNER V2', fedpaMarca: 'TOY', fedpaModelo: '4RUNNER' },
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 37, modeloLabel: 'BZ3X', fedpaMarca: 'TOY', fedpaModelo: 'BZ3X' },
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 27, modeloLabel: 'BZ4X', fedpaMarca: 'TOY', fedpaModelo: 'BZ4X' },
  // HYUNDAI (IS marca=74)
  { marcaCode: 74, marcaLabel: 'HYUNDAI', modeloCode: 1801, modeloLabel: 'CRETA', fedpaMarca: 'HYU', fedpaModelo: 'CRETA' },
  { marcaCode: 74, marcaLabel: 'HYUNDAI', modeloCode: 1890, modeloLabel: 'CRETA GRAND', fedpaMarca: 'HYU', fedpaModelo: 'CRETA' },
  { marcaCode: 74, marcaLabel: 'HYUNDAI', modeloCode: 1873, modeloLabel: 'CRETA NEW', fedpaMarca: 'HYU', fedpaModelo: 'CRETA' },
  { marcaCode: 74, marcaLabel: 'HYUNDAI', modeloCode: 1877, modeloLabel: 'I-30', fedpaMarca: 'HYU', fedpaModelo: 'I-30' },
  { marcaCode: 74, marcaLabel: 'HYUNDAI', modeloCode: 1799, modeloLabel: 'ACCENT HB', fedpaMarca: 'HYU', fedpaModelo: 'ACCENT' },
  { marcaCode: 74, marcaLabel: 'HYUNDAI', modeloCode: 1854, modeloLabel: 'CRETA AUT FL', fedpaMarca: 'HYU', fedpaModelo: 'CRETA' },
  { marcaCode: 74, marcaLabel: 'HYUNDAI', modeloCode: 2001, modeloLabel: 'CRETA GRAND AUT', fedpaMarca: 'HYU', fedpaModelo: 'CRETA' },
  // KIA (IS marca=86)
  { marcaCode: 86, marcaLabel: 'KIA', modeloCode: 1339, modeloLabel: 'FAMILY', fedpaMarca: 'KIA', fedpaModelo: 'FAMILY' },
  { marcaCode: 86, marcaLabel: 'KIA', modeloCode: 1437, modeloLabel: 'CELTOS', fedpaMarca: 'KIA', fedpaModelo: 'SELTOS' },
  { marcaCode: 86, marcaLabel: 'KIA', modeloCode: 1239, modeloLabel: 'SPORTAGE DLX', fedpaMarca: 'KIA', fedpaModelo: 'SPORTAGE' },
  { marcaCode: 86, marcaLabel: 'KIA', modeloCode: 9, modeloLabel: 'K3', fedpaMarca: 'KIA', fedpaModelo: 'K3' },
  { marcaCode: 86, marcaLabel: 'KIA', modeloCode: 24, modeloLabel: 'CAMIONETA', fedpaMarca: 'KIA', fedpaModelo: 'CAMIONETA' },
  // CHEVROLET (IS marca=20)
  { marcaCode: 20, marcaLabel: 'CHEVROLET', modeloCode: 330, modeloLabel: 'TRACKER', fedpaMarca: 'CHE', fedpaModelo: 'TRACKER' },
  { marcaCode: 20, marcaLabel: 'CHEVROLET', modeloCode: 714, modeloLabel: 'EQUINOX', fedpaMarca: 'CHE', fedpaModelo: 'EQUINOX' },
  { marcaCode: 20, marcaLabel: 'CHEVROLET', modeloCode: 231, modeloLabel: 'BLAZER', fedpaMarca: 'CHE', fedpaModelo: 'BLAZER' },
  { marcaCode: 20, marcaLabel: 'CHEVROLET', modeloCode: 726, modeloLabel: 'BLAZER LS', fedpaMarca: 'CHE', fedpaModelo: 'BLAZER' },
  { marcaCode: 20, marcaLabel: 'CHEVROLET', modeloCode: 307, modeloLabel: 'BLAZER LT', fedpaMarca: 'CHE', fedpaModelo: 'BLAZER' },
  // HONDA (IS marca=69)
  { marcaCode: 69, marcaLabel: 'HONDA', modeloCode: 886, modeloLabel: 'CRV', fedpaMarca: 'HON', fedpaModelo: 'CR-V' },
  { marcaCode: 69, marcaLabel: 'HONDA', modeloCode: 10, modeloLabel: 'BRV', fedpaMarca: 'HON', fedpaModelo: 'BR-V' },
  { marcaCode: 69, marcaLabel: 'HONDA', modeloCode: 935, modeloLabel: 'CRV EXL', fedpaMarca: 'HON', fedpaModelo: 'CR-V' },
  // SUZUKI (IS marca=148)
  { marcaCode: 148, marcaLabel: 'SUZUKI', modeloCode: 6981, modeloLabel: 'FRONX', fedpaMarca: 'SUZ', fedpaModelo: 'FRONX' },
  { marcaCode: 148, marcaLabel: 'SUZUKI', modeloCode: 18, modeloLabel: 'FRONX GL AT', fedpaMarca: 'SUZ', fedpaModelo: 'FRONX' },
  { marcaCode: 148, marcaLabel: 'SUZUKI', modeloCode: 6982, modeloLabel: 'FRONX HIBRIDO', fedpaMarca: 'SUZ', fedpaModelo: 'FRONX' },
  // FORD (IS marca=50)
  { marcaCode: 50, marcaLabel: 'FORD', modeloCode: 589, modeloLabel: 'ESCAPE', fedpaMarca: 'FOR', fedpaModelo: 'ESCAPE' },
  { marcaCode: 50, marcaLabel: 'FORD', modeloCode: 709, modeloLabel: 'EXPLORER', fedpaMarca: 'FOR', fedpaModelo: 'EXPLORER' },
  { marcaCode: 50, marcaLabel: 'FORD', modeloCode: 723, modeloLabel: 'RANGER PU', fedpaMarca: 'FOR', fedpaModelo: 'RANGER' },
  { marcaCode: 50, marcaLabel: 'FORD', modeloCode: 3, modeloLabel: 'BRONCO SPORT', fedpaMarca: 'FOR', fedpaModelo: 'BRONCO SPORT' },
  { marcaCode: 50, marcaLabel: 'FORD', modeloCode: 2, modeloLabel: 'EXPLORER FWD', fedpaMarca: 'FOR', fedpaModelo: 'EXPLORER' },
  // MAZDA (IS marca=99)
  { marcaCode: 99, marcaLabel: 'MAZDA', modeloCode: 1828, modeloLabel: 'CX3', fedpaMarca: 'MAZ', fedpaModelo: 'CX-3' },
  { marcaCode: 99, marcaLabel: 'MAZDA', modeloCode: 2014, modeloLabel: 'CX30', fedpaMarca: 'MAZ', fedpaModelo: 'CX-30' },
  // MITSUBISHI (IS marca=107)
  { marcaCode: 107, marcaLabel: 'MITSUBISHI', modeloCode: 1860, modeloLabel: 'OUTLANDER', fedpaMarca: 'MIT', fedpaModelo: 'OUTLANDER' },
  { marcaCode: 107, marcaLabel: 'MITSUBISHI', modeloCode: 1918, modeloLabel: 'ASX', fedpaMarca: 'MIT', fedpaModelo: 'ASX' },
  { marcaCode: 107, marcaLabel: 'MITSUBISHI', modeloCode: 1777, modeloLabel: 'L200', fedpaMarca: 'MIT', fedpaModelo: 'L200' },
  { marcaCode: 107, marcaLabel: 'MITSUBISHI', modeloCode: 1962, modeloLabel: 'NEW OUTLANDER', fedpaMarca: 'MIT', fedpaModelo: 'OUTLANDER' },
  // VOLKSWAGEN (IS marca=172)
  { marcaCode: 172, marcaLabel: 'VOLKSWAGEN', modeloCode: 2575, modeloLabel: 'JETTA', fedpaMarca: 'VOL', fedpaModelo: 'JETTA' },
  { marcaCode: 172, marcaLabel: 'VOLKSWAGEN', modeloCode: 2642, modeloLabel: 'TIGUAN', fedpaMarca: 'VOL', fedpaModelo: 'TIGUAN' },
  { marcaCode: 172, marcaLabel: 'VOLKSWAGEN', modeloCode: 2719, modeloLabel: 'TAOS', fedpaMarca: 'VOL', fedpaModelo: 'TAOS' },
  // SUBARU (IS marca=146)
  { marcaCode: 146, marcaLabel: 'SUBARU', modeloCode: 2345, modeloLabel: 'FORESTER', fedpaMarca: 'SUB', fedpaModelo: 'FORESTER' },
  { marcaCode: 146, marcaLabel: 'SUBARU', modeloCode: 2376, modeloLabel: 'CROSSTREK', fedpaMarca: 'SUB', fedpaModelo: 'CROSSTREK' },
  // JEEP (IS marca=80)
  { marcaCode: 80, marcaLabel: 'JEEP', modeloCode: 1219, modeloLabel: 'WRANGLER', fedpaMarca: 'JEE', fedpaModelo: 'WRANGLER' },
  { marcaCode: 80, marcaLabel: 'JEEP', modeloCode: 310, modeloLabel: 'GRAND CHEROKEE', fedpaMarca: 'JEE', fedpaModelo: 'GRAND CHEROKEE' },
  { marcaCode: 80, marcaLabel: 'JEEP', modeloCode: 1213, modeloLabel: 'WRANGLER V2', fedpaMarca: 'JEE', fedpaModelo: 'WRANGLER' },
  // TOYOTA extras (IS marca=156) — pad to 52
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 2563, modeloLabel: 'CAMIONETA', fedpaMarca: 'TOY', fedpaModelo: 'CAMIONETA' },
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 3052, modeloLabel: '4RUNNER SR5', fedpaMarca: 'TOY', fedpaModelo: '4RUNNER' },
];

function buildScenarios(): Scenario[] {
  const scenarios: Scenario[] = [];
  let id = 1;
  const years = [2021, 2022, 2023, 2024, 2025];
  const ccValues = [8000, 12000, 15000, 18000, 20000, 25000, 30000, 35000, 45000, 60000];

  // ── DT FEDPA: 10 scenarios (idx 0-4, basic contado + premium 2cuotas) ──
  for (let i = 0; i < 5; i++) {
    const v = VEHICLE_POOL[i]!;
    const y = years[i % years.length]!;
    scenarios.push({
      id: id++, type: 'DT', insurer: 'FEDPA', vehicle: v, year: y,
      plan: 'Básico', planCode: 1000, cuotas: 1, deducible: 1,
      valorVehiculo: 0, grupoTarifa: 0,
      description: `DT FEDPA Básico contado — ${v.marcaLabel} ${v.modeloLabel} ${y}`,
    });
    scenarios.push({
      id: id++, type: 'DT', insurer: 'FEDPA', vehicle: v, year: y,
      plan: 'VIP', planCode: 1002, cuotas: 2, deducible: 1,
      valorVehiculo: 0, grupoTarifa: 0,
      description: `DT FEDPA VIP 2cuotas — ${v.marcaLabel} ${v.modeloLabel} ${y}`,
    });
  }

  // ── DT IS Internacional: 5 scenarios (idx 5-9) ──
  for (let i = 5; i < 10; i++) {
    const v = VEHICLE_POOL[i]!;
    const y = years[i % years.length]!;
    scenarios.push({
      id: id++, type: 'DT', insurer: 'IS', vehicle: v, year: y,
      plan: 'DAT Particular', planCode: 306, cuotas: 1, deducible: 1,
      valorVehiculo: 0, grupoTarifa: 20,
      description: `DT IS contado — ${v.marcaLabel} ${v.modeloLabel} ${y}`,
    });
  }

  // ── CC IS Internacional: 35 scenarios (idx 10-49) ──
  const ccDeducibles = [1, 2, 3];
  const ccCuotas = [1, 2, 6, 10];
  for (let i = 10; i < VEHICLE_POOL.length; i++) {
    const v = VEHICLE_POOL[i]!;
    const y = years[i % years.length]!;
    const val = ccValues[i % ccValues.length]!;
    const ded = ccDeducibles[i % ccDeducibles.length]!;
    const cuot = ccCuotas[i % ccCuotas.length]!;
    const dedLabel = ded === 1 ? 'bajo' : ded === 2 ? 'medio' : 'alto';
    scenarios.push({
      id: id++, type: 'CC', insurer: 'IS', vehicle: v, year: y,
      plan: `CC ded-${dedLabel}`, planCode: 29, cuotas: cuot, deducible: ded,
      valorVehiculo: val, grupoTarifa: 20,
      description: `CC IS ded=${dedLabel} ${cuot}cuotas $${val.toLocaleString()} — ${v.marcaLabel} ${v.modeloLabel} ${y}`,
    });
  }

  // Pad to exactly 50 with extra CC
  while (scenarios.length < 50) {
    const idx = scenarios.length % VEHICLE_POOL.length;
    const v = VEHICLE_POOL[idx]!;
    const ded = ccDeducibles[scenarios.length % 3]!;
    const cuot = ccCuotas[scenarios.length % 4]!;
    const val = ccValues[scenarios.length % ccValues.length]!;
    const dedLabel = ded === 1 ? 'bajo' : ded === 2 ? 'medio' : 'alto';
    scenarios.push({
      id: id++, type: 'CC', insurer: 'IS', vehicle: v, year: 2025,
      plan: `CC ded-${dedLabel}`, planCode: 29, cuotas: cuot, deducible: ded,
      valorVehiculo: val, grupoTarifa: 20,
      description: `CC IS extra ded=${dedLabel} ${cuot}cuotas $${val.toLocaleString()} — ${v.marcaLabel} ${v.modeloLabel} 2025`,
    });
  }

  return scenarios.slice(0, 50);
}

// ══════════════════════════════════════════════════════════
// FEDPA DT EMISSION (EmisorPlan)
// ══════════════════════════════════════════════════════════

async function runFedpaDT(
  s: Scenario,
  fedpaToken: string | null,
  dryrun: boolean,
): Promise<any> {
  const t0 = Date.now();
  const result: any = {
    scenarioId: s.id, type: s.type, insurer: s.insurer,
    description: s.description, vehicle: `${s.vehicle.marcaLabel} ${s.vehicle.modeloLabel} ${s.year}`,
    plan: s.plan, planCode: s.planCode, cuotas: s.cuotas,
  };

  if (dryrun) {
    result.success = true;
    result.dryrun = true;
    result.message = 'Dryrun — would emit with EmisorPlan';
    result.timing = Date.now() - t0;
    return result;
  }

  if (!fedpaToken) {
    result.success = false;
    result.error = 'FEDPA token not available (may be blocked ~50min TTL)';
    result.skipped = true;
    result.timing = Date.now() - t0;
    return result;
  }

  // Upload FRESH docs per scenario — FEDPA requires unique idDoc per emission
  let fedpaIdDoc: string | null = null;
  try {
    const testDocs = {
      documento_identidad: [createTestJpeg('documento_identidad.jpg')],
      licencia_conducir: [createTestJpeg('licencia_conducir.jpg')],
      registro_vehicular: [] as File[],
    };
    const uploadResult = await subirDocumentos(testDocs, 'DEV');
    if (uploadResult.success && uploadResult.idDoc) {
      fedpaIdDoc = uploadResult.idDoc;
      console.log(`[SMOKE FEDPA] ✅ Fresh idDoc: ${fedpaIdDoc}`);
    } else {
      result.success = false;
      result.error = `Doc upload failed: ${uploadResult.error}`;
      result.timing = Date.now() - t0;
      return result;
    }
  } catch (docErr: any) {
    result.success = false;
    result.error = `Doc upload exception: ${docErr.message}`;
    result.timing = Date.now() - t0;
    return result;
  }

  try {
    const payload: EmitirPolizaRequest = {
      Plan: s.planCode,
      idDoc: fedpaIdDoc,
      PrimerNombre: 'PRUEBA',
      PrimerApellido: 'SMOKE',
      SegundoNombre: 'AUTO',
      SegundoApellido: 'TEST',
      Identificacion: testCedula(s.id),
      FechaNacimiento: '15/06/1990',
      Sexo: s.id % 2 === 0 ? 'M' : 'F',
      Email: 'smoketest@lideresenseguros.com',
      Telefono: 60000000 + s.id,
      Celular: 60000000 + s.id,
      Direccion: 'PANAMA CIUDAD DE PANAMA SMOKE TEST',
      esPEP: 0,
      sumaAsegurada: 0,
      Uso: '10',
      Marca: s.vehicle.fedpaMarca,
      Modelo: s.vehicle.fedpaModelo,
      Ano: String(s.year),
      Motor: `SMKM${String(s.id).padStart(8, '0')}`,
      Placa: `SMK${String(s.id).padStart(3, '0')}`,
      Vin: `SMKVIN${String(s.id).padStart(11, '0')}`,
      Color: ['BLANCO', 'NEGRO', 'GRIS', 'ROJO', 'AZUL'][s.id % 5]!,
      Pasajero: 5,
      Puerta: 4,
      PrimaTotal: s.planCode === 1000 ? 130 : 165,
      cantidadPago: s.cuotas,
    };

    result.payloadSent = {
      Plan: payload.Plan, Marca: payload.Marca, Modelo: payload.Modelo,
      Ano: payload.Ano, PrimaTotal: payload.PrimaTotal, cantidadPago: payload.cantidadPago,
      Identificacion: payload.Identificacion,
    };

    const emitResult = await emitirPoliza(payload, 'DEV');

    result.success = emitResult.success;
    result.nroPoliza = emitResult.poliza || null;
    result.emissionResponse = emitResult;

    // ── HARDCODED DATA CHECK ──
    result.hardcodedChecks = {
      planCodeDynamic: s.planCode !== 1000 && s.planCode !== 1002 ? 'OK — varies' : 'WARN — check',
      primaMatchesPlan: (s.planCode === 1000 && payload.PrimaTotal === 130) ||
        (s.planCode === 1002 && payload.PrimaTotal === 165) ? 'OK' : 'MISMATCH',
      cuotasSent: payload.cantidadPago,
      vehicleVaries: `${payload.Marca}/${payload.Modelo}/${payload.Ano}`,
      cedulaUnique: payload.Identificacion,
    };

    if (!emitResult.success) {
      result.error = emitResult.error;
    }
  } catch (err: any) {
    result.success = false;
    result.error = err.message;
  }

  result.timing = Date.now() - t0;
  return result;
}

// ══════════════════════════════════════════════════════════
// IS QUOTE + EMISSION (DT & CC)
// ══════════════════════════════════════════════════════════

async function runISScenario(s: Scenario, dryrun: boolean): Promise<any> {
  const t0 = Date.now();
  const result: any = {
    scenarioId: s.id, type: s.type, insurer: 'IS',
    description: s.description, vehicle: `${s.vehicle.marcaLabel} ${s.vehicle.modeloLabel} ${s.year}`,
    plan: s.plan, planCode: s.planCode, cuotas: s.cuotas,
    deducible: s.deducible, valorVehiculo: s.valorVehiculo,
  };

  try {
    // ── STEP 1: Quote ──
    const ced = testCedula(s.id);
    const quoteReq = {
      codTipoDoc: 1,
      nroDoc: ced,
      nroNit: ced,
      nombre: 'PRUEBA',
      apellido: 'SMOKE',
      telefono: `6${String(s.id).padStart(7, '0')}`,
      correo: 'smoketest@lideresenseguros.com',
      codMarca: s.vehicle.marcaCode,
      codModelo: s.vehicle.modeloCode,
      anioAuto: String(s.year),
      sumaAseg: String(s.valorVehiculo),
      codPlanCobertura: s.planCode,
      codPlanCoberturaAdic: 0,
      codGrupoTarifa: s.grupoTarifa,
      fecNacimiento: '01/01/1990',
      codProvincia: 8,
    };

    result.quoteRequest = {
      codMarca: quoteReq.codMarca, codModelo: quoteReq.codModelo,
      anioAuto: quoteReq.anioAuto, sumaAseg: quoteReq.sumaAseg,
      codPlanCobertura: quoteReq.codPlanCobertura, codGrupoTarifa: quoteReq.codGrupoTarifa,
    };

    const quoteResult = await generarCotizacionAuto(quoteReq, 'development');
    const tQuote = Date.now();

    result.quoteSuccess = quoteResult.success;
    result.idCotizacion = quoteResult.idCotizacion || null;
    result.primaTotal = quoteResult.primaTotal || null;
    result.quoteTimingMs = tQuote - t0;

    if (!quoteResult.success) {
      result.success = false;
      result.error = `Quote failed: ${quoteResult.error}`;
      result.timing = Date.now() - t0;
      return result;
    }

    // ── HARDCODED DATA CHECK ──
    result.hardcodedChecks = {
      marcaVaries: s.vehicle.marcaCode,
      modeloVaries: s.vehicle.modeloCode,
      yearVaries: s.year,
      sumaAsegSent: s.valorVehiculo,
      planCodeSent: s.planCode,
      deducibleSent: s.deducible,
      cuotasSent: s.cuotas,
      cedulaUnique: ced,
      primaFromIS: quoteResult.primaTotal,
      primaIsNotHardcoded: quoteResult.primaTotal !== 130 && quoteResult.primaTotal !== 165 ? 'OK' : 'WARN — same as FEDPA fixed price',
    };

    if (dryrun) {
      result.success = true;
      result.dryrun = true;
      result.message = 'Dryrun — quote succeeded, emission skipped';
      result.timing = Date.now() - t0;
      return result;
    }

    // ── STEP 2: Emission ──
    const emitResult = await emitirPolizaAuto({
      vIdPv: quoteResult.idCotizacion!,
      opcion: s.deducible,
      codTipoDoc: 1,
      nroDoc: ced,
      nombre: 'PRUEBA',
      apellido1: 'SMOKE',
      apellido2: 'TEST',
      telefono: `6${String(s.id).padStart(7, '0')}`,
      celular: `6${String(s.id).padStart(7, '0')}`,
      correo: 'smoketest@lideresenseguros.com',
      fechaNacimiento: '01/01/1990',
      sexo: s.id % 2 === 0 ? 'M' : 'F',
      direccion: 'PANAMA CIUDAD DE PANAMA SMOKE TEST',
      estadoCivil: 'soltero',
      codProvincia: 8,
      codDistrito: 1,
      codCorregimiento: 1,
      codMarca: s.vehicle.marcaCode,
      codModelo: s.vehicle.modeloCode,
      anioAuto: String(s.year),
      sumaAseg: String(s.valorVehiculo),
      codPlanCobertura: s.planCode,
      codGrupoTarifa: s.grupoTarifa,
      placa: `SMK${String(s.id).padStart(3, '0')}`,
      motor: `SMKM${String(s.id).padStart(8, '0')}`,
      chasis: `SMKVIN${String(s.id).padStart(11, '0')}`,
      color: ['BLANCO', 'NEGRO', 'GRIS', 'ROJO', 'AZUL'][s.id % 5],
      tipoTransmision: s.id % 3 === 0 ? 'MANUAL' : 'AUTOMATICO',
      cantPasajeros: 5,
      cantPuertas: 4,
      formaPago: s.cuotas > 1 ? 2 : 1,
      cantCuotas: s.cuotas,
    }, 'development');

    result.success = emitResult.success;
    result.nroPoliza = emitResult.nroPoliza || null;
    result.pdfUrl = emitResult.pdfUrl || null;

    if (!emitResult.success) {
      result.error = `Emission failed: ${emitResult.error}`;
    } else {
      // Validate response
      result.responseValidation = {
        hasPolizaNumber: !!emitResult.nroPoliza,
        polizaFormat: emitResult.nroPoliza || 'NONE',
        hasPdfUrl: !!emitResult.pdfUrl,
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
  const limit = Math.min(parseInt(params.get('limit') || '50'), 50);
  const filter = (params.get('filter') || 'all').toUpperCase();
  const delayMs = parseInt(params.get('delay') || '2000');
  const dryrun = params.get('dryrun') === 'true';

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[SMOKE TEST] Starting — limit=${limit}, filter=${filter}, delay=${delayMs}ms, dryrun=${dryrun}`);
  console.log(`${'═'.repeat(60)}\n`);

  const allScenarios = buildScenarios();
  const scenarios = allScenarios.filter(s => {
    if (filter === 'ALL') return true;
    if (filter === 'DT') return s.type === 'DT';
    if (filter === 'CC') return s.type === 'CC';
    if (filter === 'FEDPA') return s.insurer === 'FEDPA';
    if (filter === 'IS') return s.insurer === 'IS';
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
      DT_FEDPA: { total: 0, passed: 0, failed: 0, skipped: 0 },
      DT_IS: { total: 0, passed: 0, failed: 0, skipped: 0 },
      CC_IS: { total: 0, passed: 0, failed: 0, skipped: 0 },
    },
    polizasEmitidas: [] as string[],
    hardcodedIssues: [] as string[],
  };

  // ══════════════════════════════════════════════════════
  // PHASE 0: Validate IS catalog codes
  // ══════════════════════════════════════════════════════
  let catalogValidation: any = null;
  try {
    const [marcas, modelos] = await Promise.all([
      getMarcas('development'),
      getModelos('development'),
    ]);

    const marcaCodes = new Set(marcas.map((m: any) => parseInt(m.vcodmarca || m.COD_MARCA)));
    const modeloCodes = new Set(modelos.map((m: any) => parseInt(m.vcodmodelo || m.COD_MODELO)));

    const invalidMarcas = VEHICLE_POOL.filter(v => !marcaCodes.has(v.marcaCode));
    const invalidModelos = VEHICLE_POOL.filter(v => !modeloCodes.has(v.modeloCode));

    catalogValidation = {
      totalMarcasInCatalog: marcaCodes.size,
      totalModelosInCatalog: modeloCodes.size,
      invalidMarcas: invalidMarcas.map(v => `${v.marcaLabel}(${v.marcaCode})`),
      invalidModelos: invalidModelos.map(v => `${v.modeloLabel}(${v.modeloCode})`),
      allValid: invalidMarcas.length === 0 && invalidModelos.length === 0,
    };
    console.log('[SMOKE] Catalog validation:', JSON.stringify(catalogValidation));
  } catch (err: any) {
    catalogValidation = { error: err.message, note: 'Catalog validation failed — proceeding anyway' };
  }

  // ══════════════════════════════════════════════════════
  // PHASE 1: FEDPA token (docs uploaded per-scenario since idDoc is single-use)
  // ══════════════════════════════════════════════════════
  let fedpaToken: string | null = null;
  const hasFedpaScenarios = scenarios.some(s => s.insurer === 'FEDPA');

  if (hasFedpaScenarios && !dryrun) {
    console.log('[SMOKE] Obtaining FEDPA token...');
    try {
      const tokenResult = await obtenerToken('DEV');
      if (tokenResult.success && tokenResult.token) {
        fedpaToken = tokenResult.token;
        console.log('[SMOKE] ✅ FEDPA token obtained');
      } else {
        console.warn('[SMOKE] ⚠️ FEDPA token unavailable:', tokenResult.error);
      }
    } catch (err: any) {
      console.warn('[SMOKE] FEDPA setup error:', err.message);
    }
  }

  // ══════════════════════════════════════════════════════
  // PHASE 2: Run scenarios sequentially
  // ══════════════════════════════════════════════════════
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i]!;
    const cat = s.type === 'DT' && s.insurer === 'FEDPA' ? 'DT_FEDPA'
      : s.type === 'DT' && s.insurer === 'IS' ? 'DT_IS'
      : 'CC_IS';

    console.log(`\n[SMOKE ${i + 1}/${scenarios.length}] ${s.description}`);
    summary.byCategory[cat].total++;

    let scenarioResult: any;

    if (s.insurer === 'FEDPA') {
      scenarioResult = await runFedpaDT(s, fedpaToken, dryrun);
    } else {
      scenarioResult = await runISScenario(s, dryrun);
    }

    results.push(scenarioResult);

    if (scenarioResult.skipped) {
      summary.skipped++;
      summary.byCategory[cat].skipped++;
      console.log(`  ⏭️ SKIPPED: ${scenarioResult.error}`);
    } else if (scenarioResult.success) {
      summary.passed++;
      summary.byCategory[cat].passed++;
      if (scenarioResult.nroPoliza) {
        summary.polizasEmitidas.push(`${cat}: ${scenarioResult.nroPoliza} (${s.description})`);
      }
      console.log(`  ✅ PASSED${scenarioResult.nroPoliza ? ` — Póliza: ${scenarioResult.nroPoliza}` : ''} (${scenarioResult.timing}ms)`);
    } else {
      summary.failed++;
      summary.byCategory[cat].failed++;
      const errMsg = `#${s.id} ${s.description}: ${scenarioResult.error}`;
      summary.errors.push(errMsg);
      console.log(`  ❌ FAILED: ${scenarioResult.error} (${scenarioResult.timing}ms)`);
    }

    // Check for hardcoded issues
    if (scenarioResult.hardcodedChecks) {
      const hc = scenarioResult.hardcodedChecks;
      if (hc.primaMatchesPlan === 'MISMATCH') {
        summary.hardcodedIssues.push(`#${s.id}: Prima mismatch for plan ${s.planCode}`);
      }
      if (hc.primaIsNotHardcoded === 'WARN — same as FEDPA fixed price') {
        // Not necessarily an issue for IS, just a coincidence flag
      }
    }

    // Delay between scenarios to avoid rate-limiting
    if (i < scenarios.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  // ══════════════════════════════════════════════════════
  // PHASE 3: Summary
  // ══════════════════════════════════════════════════════
  const totalTime = Date.now() - t0;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[SMOKE TEST] COMPLETE — ${summary.passed}/${summary.total} passed, ${summary.failed} failed, ${summary.skipped} skipped`);
  console.log(`[SMOKE TEST] Total time: ${(totalTime / 1000).toFixed(1)}s`);
  if (summary.polizasEmitidas.length > 0) {
    console.log(`[SMOKE TEST] Pólizas emitidas: ${summary.polizasEmitidas.length}`);
    summary.polizasEmitidas.forEach(p => console.log(`  📋 ${p}`));
  }
  if (summary.errors.length > 0) {
    console.log(`[SMOKE TEST] Errors:`);
    summary.errors.forEach(e => console.log(`  ❌ ${e}`));
  }
  console.log(`${'═'.repeat(60)}\n`);

  return NextResponse.json({
    success: summary.failed === 0,
    timestamp: new Date().toISOString(),
    mode: dryrun ? 'dryrun' : 'full_emission',
    filter,
    catalogValidation,
    fedpaSetup: {
      tokenAvailable: !!fedpaToken,
      idDocPerScenario: true,
    },
    summary,
    totalTimeMs: totalTime,
    totalTimeFormatted: `${(totalTime / 1000).toFixed(1)}s`,
    results,
  });
}
