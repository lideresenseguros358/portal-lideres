/**
 * Normaliza texto eliminando:
 * - Acentos (á→a, é→e, í→i, ó→o, ú→u)
 * - Ñ por N
 * - Signos de puntuación (excepto espacios, guiones y números)
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/ñ/gi, 'n')              // ñ → n
    .replace(/Ñ/g, 'N')                // Ñ → N
    .replace(/[^\w\s\-]/g, '');       // Eliminar signos de puntuación (mantiene letras, números, espacios, guiones, _)
}

/**
 * Normaliza y convierte a mayúsculas
 */
export function normalizeToUpperCase(text: string): string {
  return normalizeText(text).toUpperCase();
}
