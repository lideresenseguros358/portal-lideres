/**
 * TIMEZONE UTILITIES
 * ==================
 * Helpers para manejo de fechas en America/Panama (UTC-5)
 * 
 * - Generación de AAMM para tickets
 * - Conversión de fechas con timezone correcto
 * - Helpers para SLA y validaciones de tiempo
 */

/**
 * Obtiene AAMM actual en formato AAMM (YY + MM) según America/Panama
 * Ejemplo: Enero 2026 => "2601"
 */
export function getCurrentAAMM(): string {
  // Usar Intl.DateTimeFormat para obtener fecha en America/Panama
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Panama',
    year: '2-digit',
    month: '2-digit',
  });
  
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value || '00';
  const month = parts.find(p => p.type === 'month')?.value || '00';
  
  return year + month;
}

/**
 * Obtiene la fecha/hora actual en America/Panama como Date object
 */
export function getNowInPanama(): Date {
  // Convertir la hora actual a Panama timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Panama',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(new Date());
  
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1; // 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');
  
  // Crear Date en UTC y ajustar a Panama (-5 horas)
  return new Date(Date.UTC(year, month, day, hour + 5, minute, second));
}

/**
 * Convierte una fecha ISO string a Date object en timezone Panama
 */
export function toDateInPanama(isoString: string): Date {
  const date = new Date(isoString);
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Panama',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');
  
  return new Date(Date.UTC(year, month, day, hour + 5, minute, second));
}

/**
 * Formatea fecha para display en timezone Panama
 * Ejemplo: "21 Ene 2026 09:30"
 */
export function formatDatePanama(date: Date | string, includeTime = true): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const formatter = new Intl.DateTimeFormat('es-PA', {
    timeZone: 'America/Panama',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  });
  
  return formatter.format(d);
}

/**
 * Calcula fecha de vencimiento SLA desde una fecha base
 * @param startDate - Fecha inicio
 * @param daysToAdd - Días hábiles a agregar
 * @returns Fecha de vencimiento en Panama timezone
 */
export function calculateSLADueDate(startDate: Date, daysToAdd: number): Date {
  const start = toDateInPanama(startDate.toISOString());
  
  let currentDate = new Date(start);
  let addedDays = 0;
  
  while (addedDays < daysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }
  
  return currentDate;
}

/**
 * Obtiene el inicio del día de hoy en Panama timezone
 */
export function getTodayStartPanama(): Date {
  const now = getNowInPanama();
  now.setUTCHours(5, 0, 0, 0); // Midnight en Panama = 05:00 UTC
  return now;
}

/**
 * Obtiene el fin del día de hoy en Panama timezone
 */
export function getTodayEndPanama(): Date {
  const now = getNowInPanama();
  now.setUTCHours(28, 59, 59, 999); // 23:59:59 Panama = 04:59:59 UTC next day
  return now;
}

/**
 * Valida si una fecha está en el rango de las últimas N horas (Panama time)
 */
export function isWithinLastHours(date: Date | string, hours: number): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = getNowInPanama();
  const diff = now.getTime() - d.getTime();
  const hoursDiff = diff / (1000 * 60 * 60);
  
  return hoursDiff >= 0 && hoursDiff <= hours;
}

/**
 * Agrega meses a una fecha (para Aplazado)
 * @param date - Fecha base
 * @param months - Meses a agregar (1-6)
 * @returns Fecha resultante
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
