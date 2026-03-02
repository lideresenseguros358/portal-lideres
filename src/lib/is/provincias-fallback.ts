/**
 * Catálogo estático de provincias de Panamá
 * Fallback para evitar latencia del API IS al cargar el formulario de emisión
 * 
 * Fuente: División política oficial de Panamá
 * Formato: { DATO: código numérico, TEXTO: nombre }
 * 
 * NOTA: Si se necesita actualización, comparar con respuesta de IS GET /provincias/1
 */
export const PROVINCIAS_FALLBACK: { DATO: number; TEXTO: string }[] = [
  { DATO: 1, TEXTO: 'BOCAS DEL TORO' },
  { DATO: 2, TEXTO: 'COCLÉ' },
  { DATO: 3, TEXTO: 'COLÓN' },
  { DATO: 4, TEXTO: 'CHIRIQUÍ' },
  { DATO: 5, TEXTO: 'DARIÉN' },
  { DATO: 6, TEXTO: 'HERRERA' },
  { DATO: 7, TEXTO: 'LOS SANTOS' },
  { DATO: 8, TEXTO: 'PANAMÁ' },
  { DATO: 9, TEXTO: 'VERAGUAS' },
  { DATO: 10, TEXTO: 'GUNA YALA' },
  { DATO: 11, TEXTO: 'EMBERÁ-WOUNAAN' },
  { DATO: 12, TEXTO: 'NGÄBE-BUGLÉ' },
  { DATO: 13, TEXTO: 'PANAMÁ OESTE' },
  { DATO: 14, TEXTO: 'NASO TJËR DI' },
];
