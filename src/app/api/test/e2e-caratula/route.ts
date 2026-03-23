/**
 * E2E CARÁTULA VERIFICATION — All Insurers (Regional, IS, FEDPA)
 * GET /api/test/e2e-caratula?delay=3000&dryrun=false&filter=all
 *
 * Calls the REAL portal API routes (same as the UI), sends realistic client/vehicle
 * data, and validates that the emission response echoes back the sent data —
 * confirming the carátula (policy face) uses the correct information.
 *
 * Filters: all | REGIONAL_DT | REGIONAL_CC | IS_DT | IS_CC | FEDPA_DT
 *
 * 10 Regional DT + 10 Regional CC + 5 IS DT + 5 IS CC + 5 FEDPA DT = 35 scenarios
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/security/api-guard';

export const maxDuration = 300;

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function birthDateForAge(age: number): string {
  const now = new Date();
  return `${now.getFullYear() - age}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function birthDateFedpa(age: number): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear() - age}`;
}

const BASE = typeof process !== 'undefined' && process.env.NEXTAUTH_URL
  ? process.env.NEXTAUTH_URL
  : 'http://localhost:3000';

async function apiPost(path: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ══════════════════════════════════════════════════════════
// REALISTIC TEST DATA
// ══════════════════════════════════════════════════════════

interface PersonData {
  nombre: string;
  apellido: string;
  sexo: 'M' | 'F';
  edad: number;
  email: string;
  telefono: string;
  celular: string;
}

const PERSONS: PersonData[] = [
  { nombre: 'CARLOS', apellido: 'MARTINEZ RODRIGUEZ', sexo: 'M', edad: 35, email: 'carlos.martinez@test.com', telefono: '2901001', celular: '6291001' },
  { nombre: 'MARIA', apellido: 'GONZALEZ PEREZ', sexo: 'F', edad: 28, email: 'maria.gonzalez@test.com', telefono: '2901002', celular: '6291002' },
  { nombre: 'JOSE', apellido: 'HERNANDEZ LOPEZ', sexo: 'M', edad: 42, email: 'jose.hernandez@test.com', telefono: '2901003', celular: '6291003' },
  { nombre: 'ANA', apellido: 'CASTILLO MORENO', sexo: 'F', edad: 31, email: 'ana.castillo@test.com', telefono: '2901004', celular: '6291004' },
  { nombre: 'LUIS', apellido: 'VARGAS DELGADO', sexo: 'M', edad: 39, email: 'luis.vargas@test.com', telefono: '2901005', celular: '6291005' },
  { nombre: 'CARMEN', apellido: 'RUIZ JIMENEZ', sexo: 'F', edad: 26, email: 'carmen.ruiz@test.com', telefono: '2901006', celular: '6291006' },
  { nombre: 'PEDRO', apellido: 'SOLIS NAVARRO', sexo: 'M', edad: 45, email: 'pedro.solis@test.com', telefono: '2901007', celular: '6291007' },
  { nombre: 'ROSA', apellido: 'ARIAS MENDOZA', sexo: 'F', edad: 33, email: 'rosa.arias@test.com', telefono: '2901008', celular: '6291008' },
  { nombre: 'DAVID', apellido: 'PINEDA ORTEGA', sexo: 'M', edad: 37, email: 'david.pineda@test.com', telefono: '2901009', celular: '6291009' },
  { nombre: 'LAURA', apellido: 'BATISTA RAMOS', sexo: 'F', edad: 29, email: 'laura.batista@test.com', telefono: '2901010', celular: '6291010' },
];

// Regional catalog codes (verified via /api/regional/catalogs)
interface RegVehicle { marcaCode: number; marcaLabel: string; modeloCode: number; modeloLabel: string; }
const REG_VEHICLES: RegVehicle[] = [
  { marcaCode: 74, marcaLabel: 'TOYOTA', modeloCode: 5, modeloLabel: 'COROLLA' },
  { marcaCode: 74, marcaLabel: 'TOYOTA', modeloCode: 16, modeloLabel: 'RAV4' },
  { marcaCode: 31, marcaLabel: 'HYUNDAI', modeloCode: 47, modeloLabel: 'CRETA' },
  { marcaCode: 31, marcaLabel: 'HYUNDAI', modeloCode: 20, modeloLabel: 'TUCSON' },
  { marcaCode: 40, marcaLabel: 'KIA', modeloCode: 5, modeloLabel: 'SPORTAGE' },
  { marcaCode: 40, marcaLabel: 'KIA', modeloCode: 57, modeloLabel: 'SELTOS' },
  { marcaCode: 13, marcaLabel: 'CHEVROLET', modeloCode: 52, modeloLabel: 'TRACKER' },
  { marcaCode: 30, marcaLabel: 'HONDA', modeloCode: 20, modeloLabel: 'CRV' },
  { marcaCode: 73, marcaLabel: 'SUZUKI', modeloCode: 151, modeloLabel: 'FRONX' },
  { marcaCode: 26, marcaLabel: 'FORD', modeloCode: 68, modeloLabel: 'ESCAPE' },
];

// IS catalog codes (verified via IS catalogs)
interface ISVehicle { marcaCode: number; marcaLabel: string; modeloCode: number; modeloLabel: string; fedpaMarca: string; fedpaModelo: string; }
const IS_VEHICLES: ISVehicle[] = [
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 2533, modeloLabel: 'COROLLA', fedpaMarca: 'TOY', fedpaModelo: 'COROLLA' },
  { marcaCode: 156, marcaLabel: 'TOYOTA', modeloCode: 2452, modeloLabel: 'RAV4', fedpaMarca: 'TOY', fedpaModelo: 'RAV4' },
  { marcaCode: 74, marcaLabel: 'HYUNDAI', modeloCode: 1801, modeloLabel: 'CRETA', fedpaMarca: 'HYU', fedpaModelo: 'CRETA' },
  { marcaCode: 86, marcaLabel: 'KIA', modeloCode: 1437, modeloLabel: 'SELTOS', fedpaMarca: 'KIA', fedpaModelo: 'SELTOS' },
  { marcaCode: 20, marcaLabel: 'CHEVROLET', modeloCode: 330, modeloLabel: 'TRACKER', fedpaMarca: 'CHE', fedpaModelo: 'TRACKER' },
];

const YEARS = [2021, 2022, 2023, 2024, 2025];
const COLORS_REG = ['001', '002', '003', '093', '092'];
const COLORS_IS = ['BLANCO', 'NEGRO', 'GRIS', 'ROJO', 'AZUL'];

// Unique IDs per scenario (avoid doc reuse)
function regCedula(idx: number) { return { prov: (idx % 9) + 1, tomo: 850 + idx, asiento: 6000 + idx }; }
function isCedula(idx: number) { return `${(idx % 9) + 1}-${700 + idx}-${3000 + idx}`; }

// ══════════════════════════════════════════════════════════
// CARÁTULA VALIDATION HELPERS
// ══════════════════════════════════════════════════════════

interface CaratulaCheck {
  field: string;
  sent: string;
  received: string;
  match: boolean;
}

function checkField(field: string, sent: unknown, received: unknown): CaratulaCheck {
  const s = String(sent || '').trim();
  const r = String(received || '').trim();
  return { field, sent: s, received: r, match: s === r || r.includes(s) || s.includes(r) };
}

// ══════════════════════════════════════════════════════════
// SCENARIO RUNNERS — call portal API routes (same as UI)
// ══════════════════════════════════════════════════════════

async function runRegionalDT(idx: number, person: PersonData, veh: RegVehicle, year: number, plan: string, endoso: string, dryrun: boolean) {
  const t0 = Date.now();
  const ced = regCedula(idx);
  const cedStr = `${ced.prov}-${ced.tomo}-${ced.asiento}`;
  const ts = Date.now();
  const placa = `RDT${String(ts % 100000).padStart(5, '0')}`;
  const serial = `RDTVIN${ts}`;
  const motor = `RDTM${ts}`;

  const sent = {
    plan,
    nombre: person.nombre,
    apellido: person.apellido,
    fechaNacimiento: birthDateForAge(person.edad),
    edad: person.edad,
    sexo: person.sexo,
    edocivil: 'S',
    telefono: person.telefono,
    celular: person.celular,
    email: person.email,
    codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1,
    dirhab: 'Ciudad de Panama - E2E Test',
    tppersona: 'N', tpodoc: 'C',
    prov: ced.prov, tomo: ced.tomo, asiento: ced.asiento,
    codmarca: veh.marcaCode,
    codmodelo: veh.modeloCode,
    anio: year,
    numplaca: placa,
    serialcarroceria: serial,
    serialmotor: motor,
    color: COLORS_REG[idx % COLORS_REG.length],
    condHabNombre: person.nombre,
    condHabApellido: person.apellido,
    condHabSexo: person.sexo,
    condHabEdocivil: 'S',
  };

  if (dryrun) return { success: true, dryrun: true, type: 'REGIONAL_DT', sent: { nombre: person.nombre, apellido: person.apellido, cedula: cedStr, placa, plan }, timing: Date.now() - t0 };

  const resp = await apiPost('/api/regional/auto/emit-rc', sent);

  // Validate carátula
  const checks: CaratulaCheck[] = [
    checkField('nombre', `${person.nombre} ${person.apellido}`, resp.cliente?.nombre),
    checkField('cedula', cedStr, resp.cliente?.cedula),
    checkField('email', person.email, resp.cliente?.email),
    checkField('sexo', person.sexo, resp.cliente?.sexo),
    checkField('codmarca', veh.marcaCode, resp.vehiculo?.codmarca),
    checkField('codmodelo', veh.modeloCode, resp.vehiculo?.codmodelo),
    checkField('anio', year, resp.vehiculo?.anio),
    checkField('placa', placa, resp.vehiculo?.placa),
    checkField('serialcarroceria', serial, resp.vehiculo?.serialcarroceria),
    checkField('serialmotor', motor, resp.vehiculo?.serialmotor),
    checkField('plan', plan, resp.plan),
  ];

  const allMatch = checks.every(c => c.match);
  const mismatches = checks.filter(c => !c.match);

  return {
    type: 'REGIONAL_DT',
    success: resp.success,
    poliza: resp.poliza,
    caratulaValid: allMatch,
    mismatches: mismatches.length > 0 ? mismatches : undefined,
    checks,
    error: resp.error,
    timing: Date.now() - t0,
  };
}

async function runRegionalCC(idx: number, person: PersonData, veh: RegVehicle, year: number, endoso: string, cuotas: number, valorVeh: number, dryrun: boolean) {
  const t0 = Date.now();
  const ced = regCedula(idx + 200);
  const ts = Date.now();
  const placa = `RCC${String(ts % 100000).padStart(5, '0')}`;
  const serial = `RCCVIN${ts}`;
  const motor = `RCCM${ts}`;

  // Step 1: CC Quote (through portal route)
  const quoteResp = await apiPost('/api/regional/auto/quote-cc', {
    nombre: person.nombre,
    apellido: person.apellido,
    edad: person.edad,
    sexo: person.sexo,
    edocivil: 'S',
    tppersona: 'N', tpodoc: 'C',
    prov: ced.prov, tomo: ced.tomo, asiento: ced.asiento,
    telefono: person.telefono, celular: person.celular, email: person.email,
    codMarca: veh.marcaCode, codModelo: veh.modeloCode, anio: year,
    valorVeh: valorVeh, endoso,
  });

  if (!quoteResp.success || !quoteResp.numcot) {
    return { type: 'REGIONAL_CC', success: false, error: `Quote failed: ${quoteResp.error || quoteResp.message || 'no numcot'}`, timing: Date.now() - t0 };
  }

  if (dryrun) return { success: true, dryrun: true, type: 'REGIONAL_CC', numcot: quoteResp.numcot, timing: Date.now() - t0 };

  // Step 2: Emission (through portal route)
  const emitResp = await apiPost('/api/regional/auto/emit-cc', {
    numcot: String(quoteResp.numcot),
    codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1,
    dirhab: 'Via Espana - E2E Test',
    ocupacion: 1, ingresoAnual: 1, paisTributa: 507, pep: 'N',
    vehnuevo: 'N', numplaca: placa, serialcarroceria: serial, serialmotor: motor,
    color: COLORS_REG[idx % COLORS_REG.length], usoveh: 'P', peso: 'L',
    acreedor: '81',
    cuotas: String(cuotas), opcionPrima: '1',
  });

  const checks: CaratulaCheck[] = [
    checkField('numcot', quoteResp.numcot, emitResp.numcot),
    checkField('placa', placa, emitResp.vehiculo?.placa),
    checkField('serialcarroceria', serial, emitResp.vehiculo?.serialcarroceria),
    checkField('serialmotor', motor, emitResp.vehiculo?.serialmotor),
    checkField('cuotas', cuotas, emitResp.cuotasSent),
  ];
  const allMatch = checks.every(c => c.match);
  const mismatches = checks.filter(c => !c.match);

  return {
    type: 'REGIONAL_CC',
    success: emitResp.success,
    poliza: emitResp.poliza,
    numcot: quoteResp.numcot,
    caratulaValid: allMatch,
    mismatches: mismatches.length > 0 ? mismatches : undefined,
    checks,
    error: emitResp.error,
    timing: Date.now() - t0,
  };
}

async function runISDT(idx: number, person: PersonData, veh: ISVehicle, year: number, dryrun: boolean) {
  const t0 = Date.now();
  const ced = isCedula(idx + 300);
  const placa = `IDT${String(Date.now() % 100000).padStart(5, '0')}`;
  const motor = `IDTM${Date.now()}`;
  const chasis = `IDTVIN${Date.now()}`;

  // Step 1: IS Quote
  const quoteResp = await apiPost('/api/is/auto/quote-full', {
    codTipoDoc: 1, nroDoc: ced, nroNit: ced,
    nombre: person.nombre, apellido: person.apellido,
    telefono: person.celular, correo: person.email,
    codMarca: veh.marcaCode, codModelo: veh.modeloCode,
    anioAuto: String(year), sumaAseg: '0',
    codPlanCobertura: 306, codGrupoTarifa: 20,
    fecNacimiento: birthDateFedpa(person.edad),
    codProvincia: 8,
  });

  if (!quoteResp.success || !quoteResp.idCotizacion) {
    return { type: 'IS_DT', success: false, error: `Quote failed: ${quoteResp.error}`, timing: Date.now() - t0 };
  }

  if (dryrun) return { success: true, dryrun: true, type: 'IS_DT', idCotizacion: quoteResp.idCotizacion, timing: Date.now() - t0 };

  // Step 2: Emission
  const emitResp = await apiPost('/api/is/auto/emitir', {
    vIdPv: quoteResp.idCotizacion,
    vcodtipodoc: 1, vnrodoc: ced,
    vnombre: person.nombre, vapellido1: person.apellido, vapellido2: '',
    vtelefono: person.telefono, vcelular: person.celular,
    vcorreo: person.email,
    vfecnacimiento: birthDateFedpa(person.edad),
    vsexo: person.sexo, vdireccion: 'Panama Ciudad - E2E Test',
    vestadocivil: 'soltero',
    vcodprovincia: 8, vcoddistrito: 1, vcodcorregimiento: 1,
    vcodmarca: veh.marcaCode, vmarca_label: veh.marcaLabel,
    vcodmodelo: veh.modeloCode, vmodelo_label: veh.modeloLabel,
    vanioauto: year, vsumaaseg: 0,
    vcodplancobertura: 306, vcodgrupotarifa: 20,
    vplaca: placa, vmotor: motor, vchasis: chasis,
    vcolor: COLORS_IS[idx % COLORS_IS.length],
    vtipotransmision: 'AUTOMATICO', vcantpasajeros: 5, vcantpuertas: 4,
    formaPago: 1, cantCuotas: 1,
    tipo_cobertura: 'Daños a Terceros',
    environment: 'development',
  });

  const checks: CaratulaCheck[] = [
    checkField('nombre', `${person.nombre} ${person.apellido}`, emitResp.cliente?.nombre),
    checkField('cedula', ced, emitResp.cliente?.cedula),
    checkField('email', person.email, emitResp.cliente?.email),
    checkField('marca', veh.marcaLabel, emitResp.vehiculo?.marca),
    checkField('modelo', veh.modeloLabel, emitResp.vehiculo?.modelo),
    checkField('ano', year, emitResp.vehiculo?.ano),
    checkField('placa', placa, emitResp.vehiculo?.placa),
  ];
  const allMatch = checks.every(c => c.match);
  const mismatches = checks.filter(c => !c.match);

  return {
    type: 'IS_DT',
    success: emitResp.success,
    poliza: emitResp.nroPoliza || emitResp.poliza,
    caratulaValid: allMatch,
    mismatches: mismatches.length > 0 ? mismatches : undefined,
    checks,
    error: emitResp.error,
    timing: Date.now() - t0,
  };
}

async function runISCC(idx: number, person: PersonData, veh: ISVehicle, year: number, valorVeh: number, cuotas: number, deducible: number, dryrun: boolean) {
  const t0 = Date.now();
  const ced = isCedula(idx + 400);
  const placa = `ICC${String(Date.now() % 100000).padStart(5, '0')}`;
  const motor = `ICCM${Date.now()}`;
  const chasis = `ICCVIN${Date.now()}`;

  // Step 1: IS CC Quote
  const quoteResp = await apiPost('/api/is/auto/quote-full', {
    codTipoDoc: 1, nroDoc: ced, nroNit: ced,
    nombre: person.nombre, apellido: person.apellido,
    telefono: person.celular, correo: person.email,
    codMarca: veh.marcaCode, codModelo: veh.modeloCode,
    anioAuto: String(year), sumaAseg: String(valorVeh),
    codPlanCobertura: 29, codGrupoTarifa: 20,
    fecNacimiento: birthDateFedpa(person.edad),
    codProvincia: 8,
  });

  if (!quoteResp.success || !quoteResp.idCotizacion) {
    return { type: 'IS_CC', success: false, error: `Quote failed: ${quoteResp.error}`, timing: Date.now() - t0 };
  }

  if (dryrun) return { success: true, dryrun: true, type: 'IS_CC', idCotizacion: quoteResp.idCotizacion, timing: Date.now() - t0 };

  // Step 2: Emission
  const emitResp = await apiPost('/api/is/auto/emitir', {
    vIdPv: quoteResp.idCotizacion,
    opcion: deducible,
    vcodtipodoc: 1, vnrodoc: ced,
    vnombre: person.nombre, vapellido1: person.apellido, vapellido2: '',
    vtelefono: person.telefono, vcelular: person.celular,
    vcorreo: person.email,
    vfecnacimiento: birthDateFedpa(person.edad),
    vsexo: person.sexo, vdireccion: 'Panama Ciudad - E2E CC Test',
    vestadocivil: 'soltero',
    vcodprovincia: 8, vcoddistrito: 1, vcodcorregimiento: 1,
    vcodmarca: veh.marcaCode, vmarca_label: veh.marcaLabel,
    vcodmodelo: veh.modeloCode, vmodelo_label: veh.modeloLabel,
    vanioauto: year, vsumaaseg: valorVeh,
    vcodplancobertura: 29, vcodgrupotarifa: 20,
    vplaca: placa, vmotor: motor, vchasis: chasis,
    vcolor: COLORS_IS[idx % COLORS_IS.length],
    vtipotransmision: 'AUTOMATICO', vcantpasajeros: 5, vcantpuertas: 4,
    formaPago: cuotas > 1 ? 2 : 1, cantCuotas: cuotas,
    tipo_cobertura: 'Cobertura Completa',
    environment: 'development',
  });

  const checks: CaratulaCheck[] = [
    checkField('nombre', `${person.nombre} ${person.apellido}`, emitResp.cliente?.nombre),
    checkField('cedula', ced, emitResp.cliente?.cedula),
    checkField('email', person.email, emitResp.cliente?.email),
    checkField('marca', veh.marcaLabel, emitResp.vehiculo?.marca),
    checkField('modelo', veh.modeloLabel, emitResp.vehiculo?.modelo),
    checkField('ano', year, emitResp.vehiculo?.ano),
    checkField('placa', placa, emitResp.vehiculo?.placa),
  ];
  const allMatch = checks.every(c => c.match);
  const mismatches = checks.filter(c => !c.match);

  return {
    type: 'IS_CC',
    success: emitResp.success,
    poliza: emitResp.nroPoliza || emitResp.poliza,
    caratulaValid: allMatch,
    mismatches: mismatches.length > 0 ? mismatches : undefined,
    checks,
    error: emitResp.error,
    timing: Date.now() - t0,
  };
}

async function runFedpaDT(idx: number, person: PersonData, veh: ISVehicle, year: number, planCode: number, cuotas: number, dryrun: boolean) {
  const t0 = Date.now();
  const placa = `FDT${String(Date.now() % 100000).padStart(5, '0')}`;
  const motor = `FDTM${String(idx).padStart(8, '0')}`;
  const vin = `FDTVIN${String(idx).padStart(11, '0')}`;
  const ced = isCedula(idx + 500);
  const prima = planCode === 1000 ? 130 : 165;

  // FEDPA needs idDoc from document upload first — use minimal 1px JPEG
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

  if (dryrun) return { success: true, dryrun: true, type: 'FEDPA_DT', timing: Date.now() - t0 };

  // Upload docs
  let idDoc: string | null = null;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const formData = new FormData();
    formData.append('environment', 'DEV');
    formData.append('documento_identidad', new File([bytes], 'cedula.jpg', { type: 'image/jpeg' }));
    formData.append('licencia_conducir', new File([bytes], 'licencia.jpg', { type: 'image/jpeg' }));

    const docResp = await fetch(`${BASE}/api/fedpa/documentos/upload`, { method: 'POST', body: formData });
    const docData = await docResp.json();
    if (!docData.success || !docData.idDoc) {
      return { type: 'FEDPA_DT', success: false, error: `Doc upload failed: ${docData.error || 'no idDoc'}`, timing: Date.now() - t0 };
    }
    idDoc = docData.idDoc;
  } catch (e: any) {
    return { type: 'FEDPA_DT', success: false, error: `Doc upload exception: ${e.message}`, timing: Date.now() - t0 };
  }

  // Emission
  const emitResp = await apiPost('/api/fedpa/emision', {
    environment: 'DEV',
    Plan: planCode,
    idDoc,
    PrimerNombre: person.nombre,
    PrimerApellido: person.apellido,
    SegundoNombre: '', SegundoApellido: '',
    Identificacion: ced,
    FechaNacimiento: birthDateFedpa(person.edad),
    Sexo: person.sexo,
    Email: person.email,
    Telefono: parseInt(person.telefono) || 0,
    Celular: parseInt(person.celular) || 0,
    Direccion: 'PANAMA CIUDAD - E2E FEDPA TEST',
    esPEP: 0,
    sumaAsegurada: 0,
    Uso: '10',
    Marca: veh.fedpaMarca,
    Modelo: veh.fedpaModelo,
    MarcaNombre: veh.marcaLabel,
    ModeloNombre: veh.modeloLabel,
    Ano: String(year),
    Motor: motor,
    Placa: placa,
    Vin: vin,
    Color: COLORS_IS[idx % COLORS_IS.length],
    Pasajero: 5,
    Puerta: 4,
    PrimaTotal: prima,
    cantidadPago: cuotas,
  });

  const checks: CaratulaCheck[] = [
    checkField('nombre', `${person.nombre} ${person.apellido}`, emitResp.cliente?.nombre),
    checkField('cedula', ced, emitResp.cliente?.cedula),
    checkField('email', person.email, emitResp.cliente?.email),
    checkField('sexo', person.sexo, emitResp.cliente?.sexo),
    checkField('marca', veh.fedpaMarca, emitResp.vehiculo?.marca),
    checkField('modelo', veh.fedpaModelo, emitResp.vehiculo?.modelo),
    checkField('ano', year, emitResp.vehiculo?.ano),
    checkField('placa', placa, emitResp.vehiculo?.placa),
    checkField('motor', motor, emitResp.vehiculo?.motor),
    checkField('vin', vin, emitResp.vehiculo?.vin),
  ];
  const allMatch = checks.every(c => c.match);
  const mismatches = checks.filter(c => !c.match);

  return {
    type: 'FEDPA_DT',
    success: emitResp.success,
    poliza: emitResp.poliza || emitResp.nroPoliza,
    caratulaValid: allMatch,
    mismatches: mismatches.length > 0 ? mismatches : undefined,
    checks,
    error: emitResp.error,
    timing: Date.now() - t0,
  };
}

// ══════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const authErr = requireCronSecret(request);
  if (authErr) return authErr;

  const t0 = Date.now();
  const params = request.nextUrl.searchParams;
  const delayMs = parseInt(params.get('delay') || '3000');
  const dryrun = params.get('dryrun') === 'true';
  const filter = (params.get('filter') || 'all').toUpperCase();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[E2E CARÁTULA] Starting — filter=${filter}, delay=${delayMs}ms, dryrun=${dryrun}`);
  console.log(`${'═'.repeat(60)}\n`);

  const results: any[] = [];
  const summary = {
    total: 0, passed: 0, failed: 0,
    caratulaOK: 0, caratulaMismatch: 0,
    errors: [] as string[],
    polizas: [] as string[],
    byType: {} as Record<string, { total: number; passed: number; failed: number; caratulaOK: number }>,
  };

  const run = async (type: string, fn: () => Promise<any>, desc: string) => {
    if (filter !== 'ALL' && !type.startsWith(filter) && filter !== type) return;

    summary.total++;
    if (!summary.byType[type]) summary.byType[type] = { total: 0, passed: 0, failed: 0, caratulaOK: 0 };
    summary.byType[type].total++;

    console.log(`[E2E ${summary.total}] ${desc}`);

    const result = await fn();
    result.description = desc;
    results.push(result);

    if (result.success) {
      summary.passed++;
      summary.byType[type].passed++;
      if (result.poliza) summary.polizas.push(`${type}: ${result.poliza} — ${desc}`);
      if (result.caratulaValid) {
        summary.caratulaOK++;
        summary.byType[type].caratulaOK++;
        console.log(`  ✅ PASS poliza=${result.poliza} carátula=OK (${result.timing}ms)`);
      } else if (result.dryrun) {
        console.log(`  ⏭️ DRYRUN (${result.timing}ms)`);
        summary.caratulaOK++;
        summary.byType[type].caratulaOK++;
      } else {
        summary.caratulaMismatch++;
        console.log(`  ⚠️ PASS poliza=${result.poliza} BUT carátula MISMATCH: ${JSON.stringify(result.mismatches?.map((m: any) => m.field))} (${result.timing}ms)`);
      }
    } else {
      summary.failed++;
      summary.byType[type].failed++;
      summary.errors.push(`${desc}: ${result.error}`);
      console.log(`  ❌ FAIL: ${result.error} (${result.timing}ms)`);
    }

    if (delayMs > 0) await sleep(delayMs);
  };

  // ── Regional DT: 10 scenarios ──
  const dtPlans = ['30', '31', '34', '35', '44', '45', '41', '30', '31', '34'];
  const dtEndosos = ['1', '2', '4', '4', '0', '0', '0', '1', '2', '4'];
  for (let i = 0; i < 10; i++) {
    const p = PERSONS[i]!; const v = REG_VEHICLES[i]!; const y = YEARS[i % YEARS.length]!;
    await run('REGIONAL_DT', () => runRegionalDT(i, p, v, y, dtPlans[i]!, dtEndosos[i]!, dryrun),
      `Regional DT plan=${dtPlans[i]} — ${p.nombre} ${p.apellido} ${v.marcaLabel} ${v.modeloLabel} ${y}`);
  }

  // ── Regional CC: 10 scenarios (quote-only validation — CC emission blocked by Regional API Oracle constraint) ──
  const ccEndosos = ['1', '2', '4', '1', '2', '4', '8', '1', '2', '4'];
  const ccCuotas = [1, 2, 3, 4, 6, 1, 2, 3, 4, 6];
  const ccVals = [12000, 18000, 25000, 15000, 30000, 35000, 45000, 20000, 22000, 50000];
  for (let i = 0; i < 10; i++) {
    const p = PERSONS[i]!; const v = REG_VEHICLES[i]!; const y = YEARS[i % YEARS.length]!;
    await run('REGIONAL_CC', () => runRegionalCC(i, p, v, y, ccEndosos[i]!, ccCuotas[i]!, ccVals[i]!, dryrun),
      `Regional CC endoso=${ccEndosos[i]} ${ccCuotas[i]}cuotas $${ccVals[i]} — ${p.nombre} ${p.apellido} ${v.marcaLabel} ${v.modeloLabel} ${y}`);
  }

  // ── IS DT: 5 scenarios ──
  for (let i = 0; i < 5; i++) {
    const p = PERSONS[i]!; const v = IS_VEHICLES[i]!; const y = YEARS[i]!;
    await run('IS_DT', () => runISDT(i, p, v, y, dryrun),
      `IS DT — ${p.nombre} ${p.apellido} ${v.marcaLabel} ${v.modeloLabel} ${y}`);
  }

  // ── IS CC: 5 scenarios ──
  const isCCVals = [15000, 20000, 25000, 30000, 40000];
  const isCCCuotas = [1, 2, 6, 10, 1];
  const isCCDed = [1, 2, 3, 1, 2];
  for (let i = 0; i < 5; i++) {
    const p = PERSONS[i + 5]!; const v = IS_VEHICLES[i]!; const y = YEARS[i]!;
    await run('IS_CC', () => runISCC(i, p, v, y, isCCVals[i]!, isCCCuotas[i]!, isCCDed[i]!, dryrun),
      `IS CC ded=${isCCDed[i]} ${isCCCuotas[i]}cuotas $${isCCVals[i]} — ${p.nombre} ${p.apellido} ${v.marcaLabel} ${v.modeloLabel} ${y}`);
  }

  // ── FEDPA DT: 5 scenarios ──
  const fedpaPlans = [1000, 1002, 1000, 1002, 1000];
  const fedpaCuotas = [1, 2, 1, 2, 1];
  for (let i = 0; i < 5; i++) {
    const p = PERSONS[i]!; const v = IS_VEHICLES[i]!; const y = YEARS[i]!;
    await run('FEDPA_DT', () => runFedpaDT(i, p, v, y, fedpaPlans[i]!, fedpaCuotas[i]!, dryrun),
      `FEDPA DT plan=${fedpaPlans[i]} ${fedpaCuotas[i]}cuotas — ${p.nombre} ${p.apellido} ${v.marcaLabel} ${v.modeloLabel} ${y}`);
  }

  // ── Summary ──
  const totalTime = Date.now() - t0;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[E2E CARÁTULA] COMPLETE — ${summary.passed}/${summary.total} passed | carátula OK: ${summary.caratulaOK} | mismatches: ${summary.caratulaMismatch}`);
  console.log(`[E2E CARÁTULA] Time: ${(totalTime / 1000).toFixed(1)}s`);
  if (summary.polizas.length) summary.polizas.forEach(p => console.log(`  📋 ${p}`));
  if (summary.errors.length) summary.errors.forEach(e => console.log(`  ❌ ${e}`));
  console.log(`${'═'.repeat(60)}\n`);

  return NextResponse.json({
    success: summary.failed === 0 && summary.caratulaMismatch === 0,
    timestamp: new Date().toISOString(),
    mode: dryrun ? 'dryrun' : 'full_emission',
    filter,
    summary,
    totalTimeMs: totalTime,
    totalTimeFormatted: `${(totalTime / 1000).toFixed(1)}s`,
    results,
  });
}
