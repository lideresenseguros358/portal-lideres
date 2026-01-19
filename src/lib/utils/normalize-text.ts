/**
 * Normaliza texto eliminando:
 * - Acentos (á→a, é→e, í→i, ó→o, ú→u)
 * - Ñ por N
 * - Signos de puntuación (excepto espacios, guiones y números)
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  // IMPORTANTE: Reemplazar ñ/Ñ ANTES de normalize para evitar pérdida de caracteres
  return text
    .replace(/ñ/g, 'n')               // ñ → n (PRIMERO)
    .replace(/Ñ/g, 'N')               // Ñ → N (PRIMERO)
    .normalize('NFD')                 // Descomponer acentos
    .replace(/[\u0300-\u036f]/g, '')  // Eliminar marcas diacríticas
    .replace(/[^\w\s\-]/g, '');       // Eliminar signos de puntuación
}

/**
 * Normaliza y convierte a mayúsculas
 */
export function normalizeToUpperCase(text: string): string {
  return normalizeText(text).toUpperCase();
}
