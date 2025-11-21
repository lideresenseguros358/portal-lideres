/**
 * Utilidades para manejar zona horaria de Panamá (UTC-5)
 */

/**
 * Obtiene la fecha actual en zona horaria de Panamá
 * @returns Date object ajustado a UTC-5
 */
export function getPanamaDate(): Date {
  const now = new Date();
  // Ajustar a zona horaria de Panamá (UTC-5)
  return new Date(now.getTime() - (5 * 60 * 60 * 1000));
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD para Panamá
 * @returns String en formato YYYY-MM-DD
 */
export function getPanamaTodayString(): string {
  const panamaDate = getPanamaDate();
  const year = panamaDate.getUTCFullYear();
  const month = String(panamaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(panamaDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene el día del mes actual en Panamá
 * @returns Número del día (1-31)
 */
export function getPanamaDayOfMonth(): number {
  const panamaDate = getPanamaDate();
  return panamaDate.getUTCDate();
}

/**
 * Determina la quincena actual en Panamá
 * Q1: 16-31 de cada mes
 * Q2: 01-15 de cada mes
 * @returns 'Q1' o 'Q2'
 */
export function getCurrentQuincenaPanama(): 'Q1' | 'Q2' {
  const day = getPanamaDayOfMonth();
  return day >= 16 ? 'Q1' : 'Q2';
}

/**
 * Formatea una fecha ISO a timestamp local de Panamá (sin zona horaria)
 * Útil para guardar en base de datos sin conversión UTC
 * @param date Date object o undefined para usar fecha actual
 * @returns String en formato 'YYYY-MM-DD HH:MM:SS'
 */
export function formatPanamaTimestamp(date?: Date): string {
  const targetDate = date || new Date();
  const panamaDate = new Date(targetDate.getTime() - (5 * 60 * 60 * 1000));
  
  const year = panamaDate.getUTCFullYear();
  const month = String(panamaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(panamaDate.getUTCDate()).padStart(2, '0');
  const hours = String(panamaDate.getUTCHours()).padStart(2, '0');
  const minutes = String(panamaDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(panamaDate.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
