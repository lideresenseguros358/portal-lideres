/**
 * UTILIDADES DE ZONA HORARIA PANAMÁ
 * ==================================
 * Helpers para manejar fechas en America/Panama (UTC-5)
 */

import { DateTime } from 'luxon';

const TIMEZONE = 'America/Panama';

/**
 * Obtener fecha/hora actual en Panamá
 */
export function getNowPanama(): DateTime {
  return DateTime.now().setZone(TIMEZONE);
}

/**
 * Convertir fecha UTC a Panamá
 */
export function toPanama(date: Date | string): DateTime {
  return DateTime.fromJSDate(
    typeof date === 'string' ? new Date(date) : date
  ).setZone(TIMEZONE);
}

/**
 * Obtener inicio del día en Panamá
 */
export function getStartOfDayPanama(date?: Date | string): DateTime {
  const dt = date ? toPanama(date) : getNowPanama();
  return dt.startOf('day');
}

/**
 * Obtener fin del día en Panamá
 */
export function getEndOfDayPanama(date?: Date | string): DateTime {
  const dt = date ? toPanama(date) : getNowPanama();
  return dt.endOf('day');
}

/**
 * Agregar días a una fecha en Panamá
 */
export function addDaysPanama(date: Date | string, days: number): DateTime {
  return toPanama(date).plus({ days });
}

/**
 * Calcular diferencia en días
 */
export function diffInDays(date1: Date | string, date2: Date | string): number {
  const dt1 = toPanama(date1);
  const dt2 = toPanama(date2);
  return Math.floor(dt2.diff(dt1, 'days').days);
}

/**
 * Formatear fecha para display
 */
export function formatPanama(date: Date | string, format: string = 'dd/MM/yyyy'): string {
  return toPanama(date).toFormat(format);
}

/**
 * Verificar si una fecha es hoy (en Panamá)
 */
export function isToday(date: Date | string): boolean {
  const dt = toPanama(date);
  const now = getNowPanama();
  return dt.hasSame(now, 'day');
}

/**
 * Verificar si una fecha ya pasó (en Panamá)
 */
export function isPast(date: Date | string): boolean {
  const dt = toPanama(date);
  const now = getNowPanama();
  return dt < now;
}

/**
 * Convertir a ISO string en UTC (para guardar en BD)
 */
export function toUTC(date: DateTime): string {
  return date.toUTC().toISO()!;
}
