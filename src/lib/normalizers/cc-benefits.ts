/**
 * NORMALIZADOR DE BENEFICIOS — COBERTURA COMPLETA (CC)
 * =====================================================
 * Mapea los _beneficios crudos de cada aseguradora a un listado
 * estandarizado con nombres, iconos y orden consistente.
 *
 * Listado estándar (en orden):
 *  1. Grúa
 *  2. Asistencia Vial
 *  3. Ambulancia
 *  4. Asistencia Legal
 *  5. Auto Sustituto / Alquiler
 *  6. Muerte Accidental
 *  7. Gastos Médicos / Hospitalización
 *  8. Gastos Funerarios
 *  9. Cobertura Extraterritorial
 * 10. Accidentes Personales
 *
 * Luego: extras específicos de cada aseguradora (sin subtítulo, al final).
 */

// ── Types ──

export interface NormalizedCCBenefit {
  key: string;
  icon: string;
  label: string;
  detail?: string;
  included: boolean;
}

// ── Standard benefit definitions (order matters) ──

const STANDARD_KEYS = [
  'grua',
  'asistencia_vial',
  'ambulancia',
  'asistencia_legal',
  'auto_sustituto',
  'muerte_accidental',
  'gastos_medicos',
  'gastos_funerarios',
  'extraterritorial',
  'accidentes_personales',
] as const;

const STANDARD_META: Record<string, { icon: string; label: string }> = {
  grua:                  { icon: '🚛', label: 'Grúa' },
  asistencia_vial:       { icon: '🔧', label: 'Asistencia Vial' },
  ambulancia:            { icon: '🚑', label: 'Ambulancia' },
  asistencia_legal:      { icon: '⚖️', label: 'Asistencia Legal' },
  auto_sustituto:        { icon: '🚗', label: 'Auto Sustituto' },
  muerte_accidental:     { icon: '🛡️', label: 'Muerte Accidental' },
  gastos_medicos:        { icon: '🏥', label: 'Gastos Médicos / Hospitalización' },
  gastos_funerarios:     { icon: '⚱️', label: 'Gastos Funerarios' },
  extraterritorial:      { icon: '🌎', label: 'Cobertura Extraterritorial' },
  accidentes_personales: { icon: '👥', label: 'Accidentes Personales' },
};

// ── Keyword matching ──

interface MatchRule {
  key: string;
  keywords: string[];
  /** Extract detail from the raw benefit string */
  extractDetail?: (raw: string) => string | undefined;
}

/** Pull parenthesized, "hasta/por", or colon-separated detail from a string */
function extractGenericDetail(raw: string): string | undefined {
  // Match parenthesized portion
  const paren = raw.match(/\(([^)]+)\)/);
  if (paren) return paren[1];
  // Match colon-separated detail (e.g., "🚛 Grúa: Por colisión y avería — Máx. 2 eventos/año")
  const colonDetail = raw.match(/:\s*(.+)/);
  if (colonDetail) return colonDetail[1]?.trim();
  // Match "hasta B/. ..." or "Hasta $..."
  const hasta = raw.match(/hasta\s+[\w/.]+\s*[\d,.]+/i);
  if (hasta) return hasta[0];
  // Match "B/.X" or "$X" amount patterns
  const amount = raw.match(/[Bb]\/?\.?\s*[\d,.]+|[$]\s*[\d,.]+/);
  if (amount) return amount[0];
  return undefined;
}

const MATCH_RULES: MatchRule[] = [
  { key: 'grua', keywords: ['grúa', 'grua'], extractDetail: extractGenericDetail },
  { key: 'asistencia_vial', keywords: ['asistencia vial', 'auxilio vial', 'cambio de llanta', 'paso de corriente', 'pase de corriente', 'cerrajería', 'cerrajeria', 'combustible'], extractDetail: extractGenericDetail },
  { key: 'ambulancia', keywords: ['ambulancia', 'servicios de ambulancia'], extractDetail: extractGenericDetail },
  { key: 'asistencia_legal', keywords: ['asistencia legal'], extractDetail: extractGenericDetail },
  { key: 'auto_sustituto', keywords: ['auto sustituto', 'auto de alquiler', 'alquiler de auto', 'vehículo de reemplazo', 'vehiculo de reemplazo', 'auto de reemplazo'], extractDetail: extractGenericDetail },
  { key: 'muerte_accidental', keywords: ['muerte accidental'], extractDetail: extractGenericDetail },
  { key: 'gastos_medicos', keywords: ['gastos médicos', 'gastos medicos', 'hospitalización', 'hospitalizacion', 'adelanto de gastos médicos'], extractDetail: extractGenericDetail },
  { key: 'gastos_funerarios', keywords: ['funerarios', 'funerarias'], extractDetail: extractGenericDetail },
  { key: 'extraterritorial', keywords: ['extraterritorial', 'costa rica', 'fuera del territorio', 'extensión territorial', 'extension territorial'], extractDetail: extractGenericDetail },
  { key: 'accidentes_personales', keywords: ['accidentes personales'], extractDetail: extractGenericDetail },
];

/** Try to classify a raw benefit string into a standard key */
function classifyBenefit(raw: string): { key: string; detail?: string } | null {
  const lower = raw.toLowerCase();
  for (const rule of MATCH_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return { key: rule.key, detail: rule.extractDetail?.(raw) };
    }
  }
  return null;
}

// ── Public API ──

export interface NormalizedCCResult {
  /** Standard benefits in fixed order (matched from raw) */
  standard: NormalizedCCBenefit[];
  /** Extra benefits unique to this insurer (unmatched, appended at end) */
  extras: NormalizedCCBenefit[];
}

/**
 * Normalize an array of raw beneficios into the standard ordered list + extras.
 * @param rawBeneficios The `_beneficios` array from a quote (Beneficio[] or string[])
 * @param insurerName Optional insurer name for logging
 */
export function normalizeCCBenefits(
  rawBeneficios: Array<{ nombre: string; descripcion?: string; incluido?: boolean } | string>,
  _insurerName?: string,
): NormalizedCCResult {
  // Normalize input to { nombre, detail? }
  const items = rawBeneficios.map(b => {
    if (typeof b === 'string') return { nombre: b, detail: undefined };
    return { nombre: b.nombre, detail: b.descripcion !== b.nombre ? b.descripcion : undefined };
  });

  // Track which standard keys have been matched
  const matched = new Map<string, { detail?: string }>();
  const unmatched: Array<{ nombre: string; detail?: string }> = [];

  for (const item of items) {
    const classification = classifyBenefit(item.nombre);
    if (classification && !matched.has(classification.key)) {
      matched.set(classification.key, { detail: classification.detail || item.detail });
    } else if (!classification) {
      unmatched.push(item);
    }
    // If already matched for that key, skip (avoid duplicates)
  }

  // Build standard list in fixed order
  const standard: NormalizedCCBenefit[] = STANDARD_KEYS
    .filter(key => matched.has(key))
    .map(key => {
      const meta = STANDARD_META[key]!;
      const match = matched.get(key)!;
      return {
        key,
        icon: meta.icon,
        label: meta.label,
        detail: match.detail,
        included: true,
      };
    });

  // Build extras list (insurer-specific, unmatched)
  const extras: NormalizedCCBenefit[] = unmatched.map((item, idx) => ({
    key: `extra_${idx}`,
    icon: '✦',
    label: item.nombre,
    detail: item.detail,
    included: true,
  }));

  return { standard, extras };
}
