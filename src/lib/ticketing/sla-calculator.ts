// =====================================================
// SLA CALCULATION WITH PAUSE/RESUME LOGIC
// =====================================================

import { differenceInDays, addDays, isPast, isFuture } from 'date-fns';

/**
 * Calcula la fecha SLA efectiva considerando días pausados
 */
export function calculateEffectiveSLADate(
  baseSLADate: Date | string | null,
  accumulatedPauseDays: number
): Date | null {
  if (!baseSLADate) return null;
  
  const slaDate = typeof baseSLADate === 'string' ? new Date(baseSLADate) : baseSLADate;
  
  // Sumar los días pausados a la fecha SLA original
  return addDays(slaDate, accumulatedPauseDays);
}

/**
 * Calcula días restantes hasta el SLA (negativos si vencido)
 */
export function calculateSLADaysRemaining(
  slaDate: Date | string | null,
  accumulatedPauseDays: number = 0,
  isPaused: boolean = false
): number | null {
  if (!slaDate) return null;
  
  const effectiveSLA = calculateEffectiveSLADate(slaDate, accumulatedPauseDays);
  if (!effectiveSLA) return null;
  
  // Si está pausado, retornar días como si el tiempo se hubiera detenido
  if (isPaused) {
    return differenceInDays(effectiveSLA, new Date());
  }
  
  return differenceInDays(effectiveSLA, new Date());
}

/**
 * Determina el estado del SLA (en tiempo, próximo a vencer, vencido)
 */
export function getSLAStatus(daysRemaining: number | null): 'ok' | 'warning' | 'expired' | 'none' {
  if (daysRemaining === null) return 'none';
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 5) return 'warning';
  return 'ok';
}

/**
 * Obtiene el color del badge SLA
 */
export function getSLABadgeColor(daysRemaining: number | null): string {
  const status = getSLAStatus(daysRemaining);
  
  switch (status) {
    case 'ok':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'warning':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'expired':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'none':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Obtiene el label del SLA para mostrar
 */
export function getSLALabel(daysRemaining: number | null, isPaused: boolean = false): string {
  if (daysRemaining === null) return 'Sin SLA';
  
  if (isPaused) {
    return `⏸️ Pausado (${daysRemaining}d)`;
  }
  
  if (daysRemaining < 0) {
    return `Vencido hace ${Math.abs(daysRemaining)}d`;
  }
  
  if (daysRemaining === 0) {
    return 'Vence hoy';
  }
  
  if (daysRemaining === 1) {
    return 'Vence mañana';
  }
  
  if (daysRemaining <= 5) {
    return `⚠️ ${daysRemaining}d restantes`;
  }
  
  return `${daysRemaining} días`;
}

/**
 * Calcula SLA inicial basado en ramo y modificador de trámite
 */
export function calculateInitialSLA(
  ramoSLADays: number,
  tramiteSLAModifier: number = 0
): Date {
  const totalDays = Math.max(1, ramoSLADays + tramiteSLAModifier);
  return addDays(new Date(), totalDays);
}

/**
 * Determina si se debe pausar automáticamente el SLA
 */
export function shouldPauseSLA(status: string): boolean {
  return status === 'PENDIENTE_CLIENTE' || status === 'PENDIENTE_BROKER';
}

/**
 * Calcula días transcurridos desde que se pausó
 */
export function calculatePausedDays(pausedAt: Date | string | null): number {
  if (!pausedAt) return 0;
  
  const pauseDate = typeof pausedAt === 'string' ? new Date(pausedAt) : pausedAt;
  return Math.max(0, differenceInDays(new Date(), pauseDate));
}
