/**
 * Utilidades para manejo de fechas SIN conversión de zona horaria
 * CRÍTICO: Panamá (UTC-5) - Las fechas deben ser date-only sin hora
 */

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando la zona horaria LOCAL
 * NO usa UTC para evitar cambios de día por diferencia horaria
 * 
 * @returns string en formato "YYYY-MM-DD" (ej: "2024-12-04")
 */
export function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convierte un Date object a string YYYY-MM-DD usando fecha LOCAL
 * NO usa toISOString() para evitar conversión a UTC
 * 
 * @param date - Date object a convertir
 * @returns string en formato "YYYY-MM-DD"
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Suma o resta días a una fecha manteniendo zona horaria local
 * 
 * @param dateString - Fecha en formato "YYYY-MM-DD"
 * @param days - Número de días a sumar (positivo) o restar (negativo)
 * @returns string en formato "YYYY-MM-DD"
 */
export function addDaysToLocalDate(dateString: string, days: number): string {
  const parts = dateString.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(year, month - 1, day); // Crea en zona local
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

/**
 * Obtiene fecha N días en el futuro desde hoy (zona local)
 * 
 * @param days - Número de días en el futuro
 * @returns string en formato "YYYY-MM-DD"
 */
export function getFutureDateLocal(days: number): string {
  return addDaysToLocalDate(getTodayLocalDate(), days);
}

/**
 * Obtiene fecha N días en el pasado desde hoy (zona local)
 * 
 * @param days - Número de días en el pasado
 * @returns string en formato "YYYY-MM-DD"
 */
export function getPastDateLocal(days: number): string {
  return addDaysToLocalDate(getTodayLocalDate(), -days);
}

/**
 * Suma 1 año a una fecha (para renovaciones)
 * 
 * @param dateString - Fecha en formato "YYYY-MM-DD"
 * @returns string en formato "YYYY-MM-DD"
 */
export function addOneYearToDate(dateString: string): string {
  const parts = dateString.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(year, month - 1, day);
  date.setFullYear(date.getFullYear() + 1);
  return formatLocalDate(date);
}

/**
 * Formatea fecha para display en español (dd/mm/yyyy)
 * 
 * @param dateString - Fecha en formato "YYYY-MM-DD"
 * @returns string en formato "dd/mm/yyyy"
 */
export function formatDateForDisplay(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  
  try {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
}

/**
 * Formatea fecha para display con nombre de mes en español
 * IMPORTANTE: USA new Date() con zona horaria - para fechas de pólizas/eventos
 * Para fechas de nacimiento u otras date-only, usar formatDateLongNoTimezone
 * 
 * @param dateString - Fecha en formato "YYYY-MM-DD"
 * @returns string en formato "dd de mes de yyyy"
 */
export function formatDateLongSpanish(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  
  try {
    const parts = dateString.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString('es-PA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

/**
 * Formatea fecha SIN conversión de zona horaria (parse manual)
 * CRÍTICO: Usar para fechas date-only como birth_date, issue_date, etc.
 * NO usa new Date() para evitar cambios por timezone
 * 
 * @param dateString - Fecha en formato "YYYY-MM-DD"
 * @returns string en formato "dd de mes de yyyy"
 */
export function formatDateLongNoTimezone(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  
  try {
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    
    const [year, month, day] = parts;
    if (!year || !month || !day) return dateString;
    
    const monthNames = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    
    const monthIndex = parseInt(month) - 1;
    if (monthIndex < 0 || monthIndex > 11) return dateString;
    
    return `${parseInt(day)} de ${monthNames[monthIndex]} de ${year}`;
  } catch {
    return dateString;
  }
}

/**
 * Valida si una fecha está en formato correcto YYYY-MM-DD
 * 
 * @param dateString - String a validar
 * @returns boolean
 */
export function isValidDateString(dateString: string): boolean {
  if (!dateString) return false;
  
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const parts = dateString.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(year, month - 1, day);
  
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Calcula diferencia en días entre dos fechas
 * 
 * @param date1 - Primera fecha "YYYY-MM-DD"
 * @param date2 - Segunda fecha "YYYY-MM-DD"
 * @returns número de días de diferencia (positivo si date2 > date1)
 */
export function daysDifference(date1: string, date2: string): number {
  const parts1 = date1.split('-');
  const y1 = Number(parts1[0]);
  const m1 = Number(parts1[1]);
  const d1 = Number(parts1[2]);
  
  const parts2 = date2.split('-');
  const y2 = Number(parts2[0]);
  const m2 = Number(parts2[1]);
  const d2 = Number(parts2[2]);
  
  const first = new Date(y1, m1 - 1, d1);
  const second = new Date(y2, m2 - 1, d2);
  
  const diffTime = second.getTime() - first.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Obtiene el máximo valor de fecha para inputs (hoy)
 * Útil para campos de fecha de nacimiento
 * 
 * @returns string en formato "YYYY-MM-DD"
 */
export function getMaxDateForInput(): string {
  return getTodayLocalDate();
}

/**
 * Obtiene el mínimo valor de fecha para inputs (hace N años)
 * Útil para campos de fecha de nacimiento
 * 
 * @param yearsAgo - Años atrás (default: 100)
 * @returns string en formato "YYYY-MM-DD"
 */
export function getMinDateForInput(yearsAgo: number = 100): string {
  const now = new Date();
  now.setFullYear(now.getFullYear() - yearsAgo);
  return formatLocalDate(now);
}

/**
 * Extrae fecha de un timestamp ISO o devuelve la fecha si ya está en formato correcto
 * Útil para datos que vienen de APIs o BD que pueden tener tiempo
 * 
 * @param dateOrTimestamp - Puede ser "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ss.sssZ"
 * @returns string en formato "YYYY-MM-DD"
 */
export function extractDateOnly(dateOrTimestamp: string | null | undefined): string | null {
  if (!dateOrTimestamp) return null;
  
  // Si ya está en formato YYYY-MM-DD, retornar tal cual
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOrTimestamp)) {
    return dateOrTimestamp;
  }
  
  // Si tiene timestamp, extraer solo la fecha
  if (dateOrTimestamp.includes('T')) {
    const parts = dateOrTimestamp.split('T');
    return parts[0] || null;
  }
  
  return dateOrTimestamp;
}

// ============================================
// CONSTANTES ÚTILES
// ============================================

/**
 * Formato de fecha para Panamá
 */
export const PANAMA_DATE_FORMAT = 'es-PA';

/**
 * Opciones para formatear fechas largas
 */
export const LONG_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Panama'
};

/**
 * Opciones para formatear fechas cortas
 */
export const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Panama'
};
