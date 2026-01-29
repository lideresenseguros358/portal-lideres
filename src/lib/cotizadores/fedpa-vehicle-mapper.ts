/**
 * Mapeo de Marcas y Modelos IS → FEDPA
 * FEDPA acepta códigos de marca/modelo como strings libres
 * Este mapeo convierte códigos numéricos IS a strings FEDPA
 */

// Mapeo de códigos IS a códigos FEDPA para marcas
export const IS_TO_FEDPA_MARCA: Record<number, string> = {
  // Toyota
  156: 'TOY',
  204: 'TOY',
  
  // Kia
  86: 'KIA',
  
  // Hyundai
  76: 'HYU',
  
  // Honda
  73: 'HON',
  
  // Nissan
  127: 'NIS',
  
  // Mazda
  112: 'MAZ',
  
  // Mitsubishi
  119: 'MIT',
  
  // Chevrolet
  37: 'CHE',
  
  // Ford
  59: 'FOR',
  
  // Suzuki
  173: 'SUZ',
  
  // Volkswagen
  196: 'VOL',
  
  // BMW
  16: 'BMW',
  
  // Mercedes-Benz
  115: 'MER',
  
  // Audi
  11: 'AUD',
  
  // Jeep
  81: 'JEP',
  
  // Subaru
  170: 'SUB',
  
  // Isuzu
  79: 'ISU',
  
  // Peugeot
  137: 'PEU',
  
  // Renault
  148: 'REN',
  
  // Fiat
  58: 'FIA',
  
  // Dodge
  52: 'DOD',
  
  // RAM
  145: 'RAM',
  
  // Lexus
  99: 'LEX',
  
  // Infiniti
  77: 'INF',
  
  // Acura
  2: 'ACU',
  
  // Volvo
  197: 'VOL',
  
  // Land Rover
  92: 'LRO',
  
  // Jaguar
  80: 'JAG',
  
  // Porsche
  140: 'POR',
  
  // Mini
  118: 'MIN',
  
  // Smart
  166: 'SMA',
  
  // Tesla
  177: 'TES',
  
  // BYD
  23: 'BYD',
  
  // Chery
  36: 'CHE',
  
  // JAC
  100: 'JAC',
  
  // Great Wall
  68: 'GRW',
  
  // Haval
  71: 'HAV',
  
  // MG
  116: 'MG',
  
  // Geely
  63: 'GEE',
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
