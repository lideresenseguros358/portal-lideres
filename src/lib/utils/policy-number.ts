/**
 * UTILIDADES PARA NÚMEROS DE PÓLIZA
 * 
 * Funciones de normalización, validación y parseo para números de póliza
 * según las reglas específicas de cada aseguradora.
 */

export type InsurerSlug = 
  | 'assa'
  | 'ancon'
  | 'internacional'
  | 'sura'
  | 'banesco'
  | 'mb'
  | 'fedpa'
  | 'regional'
  | 'optima'
  | 'aliado'
  | 'palig'
  | 'acerta'
  | 'mapfre'
  | 'univivir'
  | 'assistcard'
  | 'vumi'
  | 'ifs'
  | 'ww-medical'
  | 'mercantil'
  | 'general';

/**
 * Configuración de formato por aseguradora
 */
export interface PolicyFormatConfig {
  insurer: string;
  slug: InsurerSlug;
  inputCount: number;
  inputTypes: ('numeric' | 'text' | 'dropdown' | 'mixed')[];
  dropdownOptions?: string[];
  joinWith: string; // '' = sin separador, '-' = con guiones
  normalize: boolean; // Si requiere normalización especial
  reorder?: number[]; // Índices para reordenar inputs (base 0)
  removeLeadingZeros?: boolean[]; // Por cada input
  examples: string[];
  parserRule: 'full' | 'partial'; // full = buscar completo, partial = buscar parte
  parserInputs?: number[]; // Índices de inputs a usar para búsqueda (base 0)
}

/**
 * Configuraciones de todas las aseguradoras
 */
export const POLICY_FORMATS: Record<InsurerSlug, PolicyFormatConfig> = {
  'assa': {
    insurer: 'ASSA',
    slug: 'assa',
    inputCount: 3,
    inputTypes: ['numeric', 'dropdown', 'numeric'],
    dropdownOptions: ['A', 'B', 'BR', 'BC', 'BG', 'BI', 'BV', 'G', 'GC', 'GG', 'T'],
    joinWith: '',
    normalize: false,
    examples: ['02BR12345', '05A67890'],
    parserRule: 'full',
  },
  'ancon': {
    insurer: 'ANCON',
    slug: 'ancon',
    inputCount: 3,
    inputTypes: ['numeric', 'numeric', 'numeric'],
    joinWith: '-',
    normalize: false,
    examples: ['0220-00678-01', '0315-01234-02'],
    parserRule: 'partial',
    parserInputs: [1], // Solo el segundo input (índice 1)
  },
  'internacional': {
    insurer: 'INTERNACIONAL',
    slug: 'internacional',
    inputCount: 3,
    inputTypes: ['numeric', 'numeric', 'numeric'],
    joinWith: '-',
    normalize: true,
    reorder: [1, 0, 2], // input2-input1-input3
    removeLeadingZeros: [true, true, true],
    examples: ['030-0001-0000012345'],
    parserRule: 'full',
  },
  'sura': {
    insurer: 'SURA',
    slug: 'sura',
    inputCount: 1,
    inputTypes: ['mixed'],
    joinWith: '',
    normalize: false,
    examples: ['04123456897', '0234-2234-12345'],
    parserRule: 'full',
  },
  'banesco': {
    insurer: 'BANESCO',
    slug: 'banesco',
    inputCount: 4,
    inputTypes: ['numeric', 'numeric', 'numeric', 'numeric'],
    joinWith: '-',
    normalize: false,
    examples: ['1-1-10001234-0', '2-3-10005678-1'],
    parserRule: 'partial',
    parserInputs: [2], // Solo el tercer input (índice 2)
  },
  'mb': {
    insurer: 'MB',
    slug: 'mb',
    inputCount: 4,
    inputTypes: ['numeric', 'numeric', 'numeric', 'numeric'],
    joinWith: '-',
    normalize: false,
    examples: ['02-01-123456-4', '03-02-789012-5'],
    parserRule: 'partial',
    parserInputs: [2], // Solo el tercer input (índice 2)
  },
  'fedpa': {
    insurer: 'FEDPA',
    slug: 'fedpa',
    inputCount: 4,
    inputTypes: ['numeric', 'numeric', 'numeric', 'numeric'],
    joinWith: '-',
    normalize: false,
    examples: ['02-01-123456-4'],
    parserRule: 'partial',
    parserInputs: [2],
  },
  'regional': {
    insurer: 'REGIONAL',
    slug: 'regional',
    inputCount: 4,
    inputTypes: ['numeric', 'numeric', 'numeric', 'numeric'],
    joinWith: '-',
    normalize: false,
    examples: ['02-01-123456-4'],
    parserRule: 'partial',
    parserInputs: [2],
  },
  'optima': {
    insurer: 'OPTIMA',
    slug: 'optima',
    inputCount: 4,
    inputTypes: ['numeric', 'numeric', 'numeric', 'numeric'],
    joinWith: '-',
    normalize: false,
    examples: ['02-01-123456-4'],
    parserRule: 'partial',
    parserInputs: [2],
  },
  'aliado': {
    insurer: 'ALIADO',
    slug: 'aliado',
    inputCount: 4,
    inputTypes: ['numeric', 'numeric', 'numeric', 'numeric'],
    joinWith: '-',
    normalize: false,
    examples: ['02-01-123456-4'],
    parserRule: 'partial',
    parserInputs: [2],
  },
  'palig': {
    insurer: 'PALIG',
    slug: 'palig',
    inputCount: 1,
    inputTypes: ['mixed'],
    joinWith: '',
    normalize: false,
    examples: ['680882', '4239-1234'],
    parserRule: 'full',
  },
  'acerta': {
    insurer: 'ACERTA',
    slug: 'acerta',
    inputCount: 3,
    inputTypes: ['mixed', 'numeric', 'numeric'],
    joinWith: '-',
    normalize: false,
    examples: ['10-100001234-0', '12-200002345-1'],
    parserRule: 'partial',
    parserInputs: [1], // Solo el segundo input (índice 1)
  },
  'mapfre': {
    insurer: 'MAPFRE',
    slug: 'mapfre',
    inputCount: 1,
    inputTypes: ['mixed'],
    joinWith: '',
    normalize: false,
    examples: ['021234455666', 'MAP-2024-001'],
    parserRule: 'full',
  },
  'univivir': {
    insurer: 'UNIVIVIR',
    slug: 'univivir',
    inputCount: 3,
    inputTypes: ['numeric', 'numeric', 'numeric'],
    joinWith: '-',
    normalize: false,
    examples: ['01-009-22514', '01-001-12345'],
    parserRule: 'partial',
    parserInputs: [2], // Solo el tercer input (índice 2)
  },
  'assistcard': {
    insurer: 'ASSISTCARD',
    slug: 'assistcard',
    inputCount: 1,
    inputTypes: ['mixed'],
    joinWith: '',
    normalize: false,
    examples: ['123445566', 'ASS-2024-001'],
    parserRule: 'full',
  },
  'vumi': {
    insurer: 'VUMI',
    slug: 'vumi',
    inputCount: 1,
    inputTypes: ['mixed'],
    joinWith: '',
    normalize: false,
    examples: ['123445566'],
    parserRule: 'full',
  },
  'ifs': {
    insurer: 'IFS',
    slug: 'ifs',
    inputCount: 1,
    inputTypes: ['mixed'],
    joinWith: '',
    normalize: false,
    examples: ['123445566'],
    parserRule: 'full',
  },
  'ww-medical': {
    insurer: 'WW MEDICAL',
    slug: 'ww-medical',
    inputCount: 1,
    inputTypes: ['mixed'],
    joinWith: '',
    normalize: false,
    examples: ['WP69-20-11267', 'WPSR-03391'],
    parserRule: 'full',
  },
  'mercantil': {
    insurer: 'MERCANTIL',
    slug: 'mercantil',
    inputCount: 3,
    inputTypes: ['numeric', 'numeric', 'numeric'],
    joinWith: '-',
    normalize: false,
    examples: ['2-8-123', '3-9-456'],
    parserRule: 'full',
  },
  'general': {
    insurer: 'GENERAL',
    slug: 'general',
    inputCount: 3,
    inputTypes: ['mixed', 'mixed', 'mixed'],
    joinWith: '-',
    normalize: false,
    examples: ['AUTO-123456-2025', 'GEN-2024-001'],
    parserRule: 'full',
  },
};

/**
 * Remover ceros a la izquierda de un string numérico
 */
function removeLeadingZeros(value: string): string {
  if (!value) return value;
  const num = parseInt(value, 10);
  return isNaN(num) ? value : num.toString();
}

/**
 * Normalizar número de póliza según reglas de la aseguradora
 * 
 * @param insurerSlug - Slug de la aseguradora
 * @param parts - Array de strings con cada parte del número
 * @returns Número normalizado para guardar en BD
 */
export function normalizePolicyNumber(insurerSlug: InsurerSlug, parts: string[]): string {
  const config = POLICY_FORMATS[insurerSlug];
  if (!config) return parts.join('-');

  let normalizedParts = [...parts];

  if (insurerSlug === 'ww-medical') {
    const raw = String(normalizedParts[0] ?? '');
    return raw.replace(/\s+/g, '').toUpperCase();
  }

  // Normalización especial UNIVIVIR:
  // - Primer grupo siempre es 01
  // - Segundo grupo (ramo) siempre 3 dígitos
  // - Tercer grupo (nro póliza) sin ceros a la izquierda
  if (insurerSlug === 'univivir') {
    const ramoRaw = String(normalizedParts[1] ?? '').replace(/\D/g, '');
    const polRaw = String(normalizedParts[2] ?? '').replace(/\D/g, '');

    const ramo = (ramoRaw || '').padStart(3, '0').slice(-3);
    const poliza = removeLeadingZeros(polRaw);

    if (!ramo || !poliza) return ['01', ramo, poliza].filter(Boolean).join('-');
    return `01-${ramo}-${poliza}`;
  }

  // Remover ceros a la izquierda si aplica
  if (config.removeLeadingZeros) {
    normalizedParts = normalizedParts.map((part, index) => {
      if (config.removeLeadingZeros![index]) {
        return removeLeadingZeros(part);
      }
      return part;
    });
  }

  // Reordenar si aplica (INTERNACIONAL)
  if (config.reorder) {
    const reordered: string[] = [];
    config.reorder.forEach(index => {
      reordered.push(normalizedParts[index] ?? '');
    });
    normalizedParts = reordered;
  }

  // Unir con el separador configurado
  // IMPORTANTE: NO filtrar partes vacías - permitir formato con espacios en blanco
  // Ejemplo UNIVIVIR: "01--22514" (parte 1 y 2 vacías, solo parte 3 llena)
  // Esto permite que broker guarde aunque no pueda editar todas las partes
  return normalizedParts.join(config.joinWith);
}

/**
 * Obtener término de búsqueda para parsers de comisiones/morosidad
 * 
 * @param insurerSlug - Slug de la aseguradora
 * @param policyNumber - Número completo de póliza
 * @returns Término a usar en búsqueda
 */
export function getPolicySearchTerm(insurerSlug: InsurerSlug, policyNumber: string): string {
  const config = POLICY_FORMATS[insurerSlug];
  if (!config) return policyNumber;

  // Si usa búsqueda completa, retornar tal cual
  if (config.parserRule === 'full') {
    return policyNumber;
  }

  // Si usa búsqueda parcial
  if (config.parserRule === 'partial' && config.parserInputs) {
    // Separar el número de póliza
    const parts = policyNumber.split(config.joinWith || '-');
    
    // Extraer solo las partes indicadas
    const searchParts = config.parserInputs.map(index => parts[index] || '');
    
    // Para ANCON y casos similares, también buscar sin ceros
    if (insurerSlug === 'ancon' && searchParts.length === 1) {
      return removeLeadingZeros(searchParts[0] ?? '');
    }
    
    // Retornar con el mismo separador
    return searchParts.filter(p => p).join(config.joinWith);
  }

  return policyNumber;
}

/**
 * Validar formato de número de póliza
 * 
 * @param insurerSlug - Slug de la aseguradora
 * @param parts - Array de strings con cada parte
 * @returns true si es válido
 */
export function validatePolicyFormat(insurerSlug: InsurerSlug, parts: string[]): boolean {
  const config = POLICY_FORMATS[insurerSlug];
  if (!config) return false;

  // Verificar cantidad de inputs
  if (parts.length !== config.inputCount) return false;

  // IMPORTANTE: Permitir partes vacías para casos como UNIVIVIR
  // Broker no puede editar, entonces puede quedar con partes vacías
  // Al menos una parte debe tener contenido
  const hasContent = parts.some(p => p && p.trim() !== '');
  if (!hasContent) return false;

  // Verificar tipos SOLO para partes que tienen contenido
  for (let i = 0; i < parts.length; i++) {
    const type = config.inputTypes[i];
    const value = parts[i];

    // Si está vacío, saltar validación
    if (!value || value.trim() === '') continue;

    if (type === 'numeric') {
      // Solo debe contener números
      if (!/^\d+$/.test(value)) return false;
    } else if (type === 'dropdown') {
      // Debe estar en las opciones
      if (!config.dropdownOptions?.includes(value)) return false;
    }
    // 'text' y 'mixed' aceptan cualquier cosa
  }

  return true;
}

/**
 * Obtener configuración de formato para una aseguradora
 */
export function getPolicyFormatConfig(insurerSlug: InsurerSlug): PolicyFormatConfig | null {
  return POLICY_FORMATS[insurerSlug] || null;
}

/**
 * Detectar slug de aseguradora por nombre
 */
export function getInsurerSlug(insurerName: string): InsurerSlug | null {
  const normalized = insurerName.toUpperCase().trim();

  if (!normalized) return null;

  const compact = normalized.replace(/[^A-Z0-9]/g, '');

  const aliases: Array<{ slug: InsurerSlug; matches: string[] }> = [
    { slug: 'ww-medical', matches: ['WW MEDICAL', 'WORLDWIDE MEDICAL', 'WWMEDICAL', 'WORLDWIDEMEDICAL'] },
  ];

  for (const entry of aliases) {
    if (
      entry.matches.some(m => normalized.includes(m.toUpperCase().trim())) ||
      entry.matches.some(m => compact.includes(m.toUpperCase().replace(/[^A-Z0-9]/g, '')))
    ) {
      return entry.slug;
    }
  }

  // Buscar en las configuraciones
  for (const [slug, config] of Object.entries(POLICY_FORMATS)) {
    const configName = config.insurer.toUpperCase().trim();
    if (configName && configName === normalized) {
      return slug as InsurerSlug;
    }
  }

  for (const [slug, config] of Object.entries(POLICY_FORMATS)) {
    const configName = config.insurer.toUpperCase().trim();
    if (configName && (normalized.includes(configName) || compact.includes(configName.replace(/[^A-Z0-9]/g, '')))) {
      return slug as InsurerSlug;
    }
  }

  return null;
}
