/**
 * Mapeo de Marcas y Modelos IS → FEDPA
 * FEDPA acepta códigos de marca/modelo como strings libres
 * Este mapeo convierte códigos numéricos IS a strings FEDPA
 */

// Mapeo de códigos IS a códigos FEDPA para marcas
export const IS_TO_FEDPA_MARCA: Record<number, string> = {
  // Verified against IS production catalog (2025)
  156: 'TOY',  // TOYOTA
  86: 'KIA',   // KIA
  74: 'HYU',   // HYUNDAI
  69: 'HON',   // HONDA
  113: 'NIS',  // NISSAN
  99: 'MAZ',   // MAZDA
  107: 'MIT',  // MITSUBISHI
  20: 'CHE',   // CHEVROLET
  50: 'FOR',   // FORD
  148: 'SUZ',  // SUZUKI
  172: 'VOL',  // VOLKSWAGEN
  8: 'BMW',    // BMW
  1012: 'MER', // MERCEDES
  5: 'AUD',    // AUDI
  80: 'JEP',   // JEEP
  146: 'SUB',  // SUBARU
  77: 'ISU',   // ISUZU
  119: 'PEU',  // PEUGEOT
  129: 'REN',  // RENAULT
  49: 'FIA',   // FIAT
  38: 'DOD',   // DODGE
  855: 'RAM',  // RAM
  92: 'LEX',   // LEXUS
  506: 'INF',  // INFINITI
  250: 'ACU',  // ACURA
  174: 'VOL',  // VOLVO
  91: 'LRO',   // LAND ROVER
  79: 'JAG',   // JAGUAR
  124: 'POR',  // PORSCHE
  215: 'MIN',  // MINI
  429: 'SMA',  // SMART
  839: 'TES',  // TESLA
  417: 'BYD',  // BYD
  233: 'CHR',  // CHERY
  225: 'JAC',  // JAC
  214: 'GRW',  // GREAT WALL
  570: 'HAV',  // HAVAL
  418: 'MG',   // MG
  217: 'GEE',  // GEELY
};

/**
 * Obtener código FEDPA de marca desde código IS
 * Si no existe mapeo, usa las primeras 3 letras del nombre
 */
export function getFedpaMarcaFromIS(codigoIS: number, nombreMarca?: string): string {
  // Primero buscar en mapeo
  if (IS_TO_FEDPA_MARCA[codigoIS]) {
    return IS_TO_FEDPA_MARCA[codigoIS];
  }
  
  // Si hay nombre, usar primeras 3 letras en mayúsculas
  if (nombreMarca && nombreMarca.length >= 3) {
    return nombreMarca.substring(0, 3).toUpperCase();
  }
  
  // Fallback genérico
  return 'OTH'; // Other
}

/**
 * Normalizar nombre de modelo para FEDPA
 * FEDPA acepta nombres de modelo como strings (ej: 'FORTUNER', 'COROLLA')
 * Simplemente normalizar a mayúsculas y quitar espacios extra
 */
export function normalizarModeloFedpa(nombreModelo: string): string {
  if (!nombreModelo || nombreModelo.trim() === '') {
    return 'AUTO';
  }
  
  return nombreModelo
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ') // Normalizar espacios múltiples
    .substring(0, 30); // FEDPA podría tener límite de caracteres
}

/**
 * Ejemplos de normalización:
 * - "Fortuner" → "FORTUNER"
 * - "corolla xli" → "COROLLA XLI"
 * - "civic  ex" → "CIVIC EX"
 * - "" → "AUTO"
 */
