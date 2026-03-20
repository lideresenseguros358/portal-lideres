/**
 * NORMALIZADOR DE BENEFICIOS — DAÑOS A TERCEROS
 * ===============================================
 * Mapea los datos crudos de cada aseguradora (coverageList + endosoBenefits)
 * a un listado estandarizado de coberturas y beneficios para la UI.
 *
 * Listado estándar:
 *  COBERTURAS (siempre visibles):
 *   1. Lesiones Corporales
 *   2. Daños a la Propiedad
 *   3. Gastos Médicos
 *
 *  BENEFICIOS (collapsible):
 *   4. Muerte Accidental Conductor
 *   5. Muerte Accidental Pasajeros
 *   6. Gastos Funerarios
 *   7. Asistencia en Accidentes
 *   8. Ambulancia
 *   9. Asistencia Vial (pase de corriente, combustible, cambio llanta, cerrajería)
 *  10. Grúa
 *  11. Asistencia Legal
 */

import type { AutoThirdPartyPlan } from '@/lib/constants/auto-quotes';

// ── Types ──

export type BenefitStatus =
  | { type: 'included'; amount?: string; detail?: string }
  | { type: 'excluded' }
  | { type: 'conexion'; detail?: string }; // IS básico: "Conexión" = not covered, they help contact

export interface StandardBenefit {
  key: string;
  label: string;
  icon: string;       // emoji icon
  status: BenefitStatus;
}

export interface NormalizedPlanBenefits {
  /** Top-level coverages (always visible) */
  coverages: StandardBenefit[];
  /** Additional benefits (collapsible) */
  benefits: StandardBenefit[];
}

// ── Helpers ──

function included(amount?: string, detail?: string): BenefitStatus {
  return { type: 'included', amount, detail };
}
function excluded(): BenefitStatus {
  return { type: 'excluded' };
}
function conexion(detail?: string): BenefitStatus {
  return { type: 'conexion', detail };
}

/** Extract a coverage limit from coverageList by code pattern */
function findCovLimit(plan: AutoThirdPartyPlan, ...codes: string[]): string | null {
  if (!plan.coverageList) return null;
  for (const code of codes) {
    const cov = plan.coverageList.find(c =>
      c.code.toUpperCase() === code.toUpperCase()
    );
    if (cov && cov.limit && cov.limit !== 'INCLUIDO') return cov.limit;
  }
  return null;
}

/** Check if coverageList has a code */
function hasCovCode(plan: AutoThirdPartyPlan, ...codes: string[]): boolean {
  if (!plan.coverageList) return false;
  return codes.some(code =>
    plan.coverageList!.some(c => c.code.toUpperCase() === code.toUpperCase())
  );
}

/** Search endosoBenefits for a keyword match (case-insensitive) */
function findBenefit(plan: AutoThirdPartyPlan, ...keywords: string[]): string | null {
  if (!plan.endosoBenefits) return null;
  for (const kw of keywords) {
    const found = plan.endosoBenefits.find(b =>
      b.toLowerCase().includes(kw.toLowerCase())
    );
    if (found) return found;
  }
  return null;
}

/**
 * Format coverage limit for compact display.
 * "$5,000.00 / $10,000.00" → { amount: "5,000 / 10,000", detail: "por persona / por accidente" }
 * "$5,000.00" → { amount: "5,000" }
 * "$500.00 / $2,500.00" → { amount: "500 / 2,500", detail: "por persona / por accidente" }
 */
function formatLimit(raw: string | null): { amount: string; detail?: string } | null {
  if (!raw) return null;

  // Clean up: remove .00, extra spaces
  let cleaned = raw.replace(/\.00/g, '').trim();

  // Check if it has a slash (dual limit)
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/').map(p => p.trim().replace(/^\$/, ''));
    if (parts.length === 2) {
      return {
        amount: `${parts[0]} / ${parts[1]}`,
        detail: 'por persona / por accidente',
      };
    }
  }

  // Single value
  cleaned = cleaned.replace(/^\$/, '');
  return { amount: cleaned };
}

/** Extract detail from a benefit string: "Grúa por accidente (1 evento/año, hasta $100)" → detail */
function extractDetail(benefitStr: string): string | null {
  const match = benefitStr.match(/\(([^)]+)\)/);
  return match?.[1] ?? null;
}

// ── Per-insurer normalizers ──

function normalizeIS(plan: AutoThirdPartyPlan, planType: 'basic' | 'premium'): NormalizedPlanBenefits {
  const isBasic = planType === 'basic';

  const lcLimit = findCovLimit(plan, 'LC') || (isBasic ? '$5,000 / $10,000' : '$10,000 / $20,000');
  const dpaLimit = findCovLimit(plan, 'DPA') || (isBasic ? '$5,000' : '$10,000');
  const gmLimit = findCovLimit(plan, 'GM') || (isBasic ? '$500 / $2,500' : '$2,000 / $10,000');

  const gruaBenefit = findBenefit(plan, 'grúa', 'grua');
  const asistVialBenefit = findBenefit(plan, 'asistencia vial', 'cambio de llanta');

  const coverages: StandardBenefit[] = [
    { key: 'bodilyInjury', label: 'Lesiones Corporales', icon: '🩹', status: included(formatLimit(lcLimit)?.amount, formatLimit(lcLimit)?.detail) },
    { key: 'propertyDamage', label: 'Daños a la Propiedad', icon: '🏠', status: included(formatLimit(dpaLimit)?.amount) },
    { key: 'medicalExpenses', label: 'Gastos Médicos', icon: '🏥', status: included(formatLimit(gmLimit)?.amount, formatLimit(gmLimit)?.detail) },
  ];

  const benefits: StandardBenefit[] = [
    { key: 'accidentalDeathDriver', label: 'Muerte Accidental Conductor', icon: '🛡️', status: excluded() },
    { key: 'accidentalDeathPassengers', label: 'Muerte Accidental Pasajeros', icon: '👥', status: excluded() },
    { key: 'funeralExpenses', label: 'Gastos Funerarios', icon: '⚱️', status: excluded() },
    { key: 'accidentAssistance', label: 'Asistencia en Accidentes', icon: '🚨', status: included() },
    { key: 'ambulance', label: 'Ambulancia', icon: '🚑', status: included() },
    { key: 'roadAssistance', label: 'Asistencia Vial', icon: '🔧',
      status: isBasic
        ? conexion('Paso de corriente, cambio de llanta, abasto de combustible, cerrajería')
        : included(undefined, asistVialBenefit ? (extractDetail(asistVialBenefit) || 'Paso de corriente, cambio de llanta, abasto de combustible, cerrajería — Hasta B/.150, máx. 3 eventos/año') : 'Paso de corriente, cambio de llanta, abasto de combustible, cerrajería — Hasta B/.150, máx. 3 eventos/año') },
    { key: 'towing', label: 'Grúa', icon: '🚛',
      status: isBasic
        ? conexion('Por accidente o avería')
        : included(undefined, gruaBenefit ? (extractDetail(gruaBenefit) || 'Por accidente o avería — Hasta B/.150, máx. 3 eventos/año') : 'Por accidente o avería — Hasta B/.150, máx. 3 eventos/año') },
    { key: 'legalAssistance', label: 'Asistencia Legal', icon: '⚖️', status: included() },
  ];

  return { coverages, benefits };
}

function normalizeFEDPA(plan: AutoThirdPartyPlan, planType: 'basic' | 'premium'): NormalizedPlanBenefits {
  const isBasic = planType === 'basic';

  const lcLimit = findCovLimit(plan, 'A', 'LC') || (isBasic ? '$5,000 / $10,000' : '$25,000 / $50,000');
  const dpaLimit = findCovLimit(plan, 'B', 'DPA') || (isBasic ? '$5,000' : '$25,000');
  const gmLimit = findCovLimit(plan, 'C', 'GM');
  const maLimit = findCovLimit(plan, 'H-1');
  const gfLimit = findCovLimit(plan, 'K6');

  const gruaBenefit = findBenefit(plan, 'grúa', 'grua');
  const asistVialBenefit = findBenefit(plan, 'auxilio vial', 'asistencia vial', 'cambio de llanta');
  const ambulanciaBenefit = findBenefit(plan, 'ambulancia');

  const coverages: StandardBenefit[] = [
    { key: 'bodilyInjury', label: 'Lesiones Corporales', icon: '🩹', status: included(formatLimit(lcLimit)?.amount, formatLimit(lcLimit)?.detail) },
    { key: 'propertyDamage', label: 'Daños a la Propiedad', icon: '🏠', status: included(formatLimit(dpaLimit)?.amount) },
    { key: 'medicalExpenses', label: 'Gastos Médicos', icon: '🏥', status: gmLimit ? included(formatLimit(gmLimit)?.amount, formatLimit(gmLimit)?.detail) : excluded() },
  ];

  const benefits: StandardBenefit[] = [
    { key: 'accidentalDeathDriver', label: 'Muerte Accidental Conductor', icon: '🛡️',
      status: maLimit ? included(formatLimit(maLimit)?.amount) : excluded() },
    { key: 'accidentalDeathPassengers', label: 'Muerte Accidental Pasajeros', icon: '👥', status: excluded() },
    { key: 'funeralExpenses', label: 'Gastos Funerarios', icon: '⚱️',
      status: gfLimit ? included(formatLimit(gfLimit)?.amount) : excluded() },
    { key: 'accidentAssistance', label: 'Asistencia en Accidentes', icon: '🚨', status: included() },
    { key: 'ambulance', label: 'Ambulancia', icon: '🚑',
      status: ambulanciaBenefit ? included(undefined, extractDetail(ambulanciaBenefit) || 'Hasta $200/año') : included(undefined, 'Hasta $200/año') },
    { key: 'roadAssistance', label: 'Asistencia Vial', icon: '🔧',
      status: isBasic
        ? excluded()
        : (asistVialBenefit ? included(undefined, extractDetail(asistVialBenefit) || 'Paso de corriente, cambio de llanta, abasto de combustible, cerrajería — 1 evento/año, hasta $100') : included(undefined, 'Paso de corriente, cambio de llanta, abasto de combustible, cerrajería — 1 evento/año, hasta $100')) },
    { key: 'towing', label: 'Grúa', icon: '🚛',
      status: gruaBenefit
        ? included(undefined, extractDetail(gruaBenefit) || (isBasic ? 'Solo por avería — 1 evento/año, hasta $100' : 'Por accidente y avería — 2 eventos/año, hasta $150'))
        : included(undefined, isBasic ? 'Solo por avería — 1 evento/año, hasta $100' : 'Por accidente y avería — 2 eventos/año, hasta $150') },
    { key: 'legalAssistance', label: 'Asistencia Legal', icon: '⚖️', status: included() },
  ];

  return { coverages, benefits };
}

function normalizeRegional(plan: AutoThirdPartyPlan, planType: 'basic' | 'premium'): NormalizedPlanBenefits {
  const isBasic = planType === 'basic';

  const lcLimit = findCovLimit(plan, 'LC') || (isBasic ? '$5,000 / $10,000' : '$10,000 / $20,000');
  const dpaLimit = findCovLimit(plan, 'DPA') || (isBasic ? '$5,000' : '$10,000');
  const gmLimit = findCovLimit(plan, 'GM') || (isBasic ? null : '$500 / $2,500');

  const gruaBenefit = findBenefit(plan, 'grúa', 'grua');
  const asistVialBenefit = findBenefit(plan, 'asistencia vial', 'cambio de llanta');
  const ambulanciaBenefit = findBenefit(plan, 'ambulancia');

  const coverages: StandardBenefit[] = [
    { key: 'bodilyInjury', label: 'Lesiones Corporales', icon: '🩹', status: included(formatLimit(lcLimit)?.amount, formatLimit(lcLimit)?.detail) },
    { key: 'propertyDamage', label: 'Daños a la Propiedad', icon: '🏠', status: included(formatLimit(dpaLimit)?.amount) },
    { key: 'medicalExpenses', label: 'Gastos Médicos', icon: '🏥', status: gmLimit ? included(formatLimit(gmLimit)?.amount, formatLimit(gmLimit)?.detail) : excluded() },
  ];

  const benefits: StandardBenefit[] = [
    { key: 'accidentalDeathDriver', label: 'Muerte Accidental Conductor', icon: '🛡️', status: excluded() },
    { key: 'accidentalDeathPassengers', label: 'Muerte Accidental Pasajeros', icon: '👥', status: excluded() },
    { key: 'funeralExpenses', label: 'Gastos Funerarios', icon: '⚱️', status: included('2,000') },
    { key: 'accidentAssistance', label: 'Asistencia en Accidentes', icon: '🚨', status: included() },
    { key: 'ambulance', label: 'Ambulancia', icon: '🚑',
      status: ambulanciaBenefit ? included() : included() },
    { key: 'roadAssistance', label: 'Asistencia Vial', icon: '🔧',
      status: isBasic
        ? excluded()
        : (asistVialBenefit ? included(undefined, extractDetail(asistVialBenefit) || 'Paso de corriente, cambio de llanta, abasto de combustible, cerrajería — Hasta B/.150, máx. 3 eventos/año') : included(undefined, 'Paso de corriente, cambio de llanta, abasto de combustible, cerrajería — Hasta B/.150, máx. 3 eventos/año')) },
    { key: 'towing', label: 'Grúa', icon: '🚛',
      status: isBasic
        ? excluded()
        : (gruaBenefit ? included(undefined, extractDetail(gruaBenefit) || 'Por accidente y avería — Máximo B/.150') : included(undefined, 'Por accidente y avería — Máximo B/.150')) },
    { key: 'legalAssistance', label: 'Asistencia Legal', icon: '⚖️', status: included() },
  ];

  return { coverages, benefits };
}

function normalizeAncon(plan: AutoThirdPartyPlan, planType: 'basic' | 'premium'): NormalizedPlanBenefits {
  const isBasic = planType === 'basic';

  const lcLimit = isBasic ? '$5,000 / $10,000' : '$5,000 / $10,000';
  const dpaLimit = isBasic ? '$5,000' : '$5,000';
  const gmLimit = isBasic ? null : '$500 / $2,500';
  const maLimit = findCovLimit(plan, 'MA');

  const coverages: StandardBenefit[] = [
    { key: 'bodilyInjury', label: 'Lesiones Corporales', icon: '🩹', status: included(formatLimit(lcLimit)?.amount, formatLimit(lcLimit)?.detail) },
    { key: 'propertyDamage', label: 'Daños a la Propiedad', icon: '🏠', status: included(formatLimit(dpaLimit)?.amount) },
    { key: 'medicalExpenses', label: 'Gastos Médicos', icon: '🏥', status: gmLimit ? included(formatLimit(gmLimit)?.amount, formatLimit(gmLimit)?.detail) : excluded() },
  ];

  const benefits: StandardBenefit[] = [
    { key: 'accidentalDeathDriver', label: 'Muerte Accidental Conductor', icon: '🛡️',
      status: maLimit ? included(formatLimit(maLimit)?.amount) : excluded() },
    { key: 'accidentalDeathPassengers', label: 'Muerte Accidental Pasajeros', icon: '👥', status: excluded() },
    { key: 'funeralExpenses', label: 'Gastos Funerarios', icon: '⚱️', status: excluded() },
    { key: 'accidentAssistance', label: 'Asistencia en Accidentes', icon: '🚨',
      status: isBasic ? excluded() : excluded() },
    { key: 'ambulance', label: 'Ambulancia', icon: '🚑',
      status: isBasic ? excluded() : excluded() },
    { key: 'roadAssistance', label: 'Asistencia Vial', icon: '🔧',
      status: isBasic ? excluded() : excluded() },
    { key: 'towing', label: 'Grúa', icon: '🚛',
      status: isBasic
        ? excluded()
        : included(undefined, 'Por accidente y avería — Máximo B/.150') },
    { key: 'legalAssistance', label: 'Asistencia Legal', icon: '⚖️',
      status: isBasic ? excluded() : included() },
  ];

  return { coverages, benefits };
}

// ── Public API ──

/**
 * Normalize an insurer's plan data into the standard benefits list.
 * Call this from the UI component to get a consistent structure for all insurers.
 */
export function normalizePlanBenefits(
  insurerId: string,
  plan: AutoThirdPartyPlan,
  planType: 'basic' | 'premium',
): NormalizedPlanBenefits {
  switch (insurerId) {
    case 'internacional': return normalizeIS(plan, planType);
    case 'fedpa':         return normalizeFEDPA(plan, planType);
    case 'regional':      return normalizeRegional(plan, planType);
    case 'ancon':         return normalizeAncon(plan, planType);
    default:
      // Generic fallback — mark everything as excluded
      return {
        coverages: [
          { key: 'bodilyInjury', label: 'Lesiones Corporales', icon: '🩹', status: excluded() },
          { key: 'propertyDamage', label: 'Daños a la Propiedad', icon: '🏠', status: excluded() },
          { key: 'medicalExpenses', label: 'Gastos Médicos', icon: '🏥', status: excluded() },
        ],
        benefits: [
          { key: 'accidentalDeathDriver', label: 'Muerte Accidental Conductor', icon: '🛡️', status: excluded() },
          { key: 'accidentalDeathPassengers', label: 'Muerte Accidental Pasajeros', icon: '👥', status: excluded() },
          { key: 'funeralExpenses', label: 'Gastos Funerarios', icon: '⚱️', status: excluded() },
          { key: 'accidentAssistance', label: 'Asistencia en Accidentes', icon: '🚨', status: excluded() },
          { key: 'ambulance', label: 'Ambulancia', icon: '🚑', status: excluded() },
          { key: 'roadAssistance', label: 'Asistencia Vial', icon: '🔧', status: excluded() },
          { key: 'towing', label: 'Grúa', icon: '🚛', status: excluded() },
          { key: 'legalAssistance', label: 'Asistencia Legal', icon: '⚖️', status: excluded() },
        ],
      };
  }
}
