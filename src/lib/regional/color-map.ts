/**
 * Vehicle Color Catalog
 *
 * Single source of truth used for:
 *  1. Frontend dropdown (all insurers) — user picks a label like "BLANCO".
 *  2. Regional API emission — backend converts the label to its catalog code.
 *  3. Other insurers (FEDPA, IS, etc.) — the label text is sent as-is.
 *
 * Based on Regional /regional/ws/colorVeh catalog.
 */

export interface VehicleColor {
  code: string;   // Regional catalog code, e.g. "001"
  label: string;  // Display label (uppercase Spanish), e.g. "BLANCO"
}

/**
 * Canonical color list shown in the vehicle-data dropdown.
 * Ordered by most-common first.
 */
export const VEHICLE_COLORS: VehicleColor[] = [
  { code: '001', label: 'BLANCO' },
  { code: '002', label: 'NEGRO' },
  { code: '003', label: 'GRIS' },
  { code: '004', label: 'PLATA' },
  { code: '005', label: 'ROJO' },
  { code: '006', label: 'AZUL' },
  { code: '007', label: 'VERDE' },
  { code: '008', label: 'AMARILLO' },
  { code: '009', label: 'NARANJA' },
  { code: '010', label: 'MARRÓN' },
  { code: '011', label: 'BEIGE' },
  { code: '012', label: 'DORADO' },
  { code: '013', label: 'VINOTINTO' },
  { code: '014', label: 'CREMA' },
  { code: '015', label: 'CELESTE' },
  { code: '016', label: 'TURQUESA' },
  { code: '017', label: 'MORADO' },
  { code: '018', label: 'ROSADO' },
  { code: '019', label: 'CHAMPAGNE' },
  { code: '020', label: 'BRONCE' },
  { code: '021', label: 'COBRE' },
  { code: '022', label: 'GRAFITO' },
  { code: '023', label: 'PERLA' },
  { code: '024', label: 'ARENA' },
  { code: '025', label: 'CHOCOLATE' },
  { code: '026', label: 'TITANIO' },
  { code: '027', label: 'ACERO' },
  { code: '093', label: 'OTRO' },
];

// ── Lookup helpers (built from the canonical list) ──

const _labelToCode = new Map<string, string>();
VEHICLE_COLORS.forEach(c => _labelToCode.set(c.label.toLowerCase(), c.code));
// Extra aliases that map to the same codes
const _ALIASES: Record<string, string> = {
  'plateado': '004',
  'anaranjado': '009',
  'cafe': '010',
  'café': '010',
  'oro': '012',
  'vino': '013',
  'burgundy': '013',
  'guinda': '013',
  'purpura': '017',
  'púrpura': '017',
  'rosa': '018',
  'champaña': '019',
  'otros': '093',
  // English
  'white': '001',
  'black': '002',
  'gray': '003',
  'grey': '003',
  'silver': '004',
  'red': '005',
  'blue': '006',
  'green': '007',
  'yellow': '008',
  'orange': '009',
  'brown': '010',
  'gold': '012',
  'other': '093',
};

/**
 * Convert a color label (from the dropdown) to a Regional API catalog code.
 * Falls back to "093" (OTRO) when no match is found.
 */
export function colorToRegionalCode(colorText: string): string {
  if (!colorText) return '093';

  const trimmed = colorText.trim();

  // Already a numeric code? Return as-is (padded to 3 digits)
  if (/^\d{1,3}$/.test(trimmed)) {
    return trimmed.padStart(3, '0');
  }

  const lower = trimmed.toLowerCase();

  // 1. Direct label match
  const direct = _labelToCode.get(lower);
  if (direct) return direct;

  // 2. Alias match (accent-insensitive)
  const normalized = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (_ALIASES[normalized]) return _ALIASES[normalized];
  if (_ALIASES[lower]) return _ALIASES[lower];

  // 3. Partial / contains match
  for (const [alias, code] of Object.entries(_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) return code;
  }
  for (const [lbl, code] of _labelToCode.entries()) {
    if (normalized.includes(lbl) || lbl.includes(normalized)) return code;
  }

  return '093';
}
