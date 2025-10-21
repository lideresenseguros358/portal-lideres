// SLA utilities for cases module

export type SLAStatus = 'ON_TIME' | 'DUE_SOON' | 'OVERDUE';

export interface SLAInfo {
  status: SLAStatus;
  days_remaining: number;
  color: string;
  icon: string;
  text: string;
}

/**
 * Calculates days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffMs = date2.getTime() - date1.getTime();
  return Math.floor(diffMs / oneDay);
}

/**
 * Adds days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculates SLA date from creation date and SLA days
 */
export function calculateSlaDate(createdAt: Date, slaDays: number): Date {
  return addDays(createdAt, slaDays);
}

/**
 * Determines SLA status based on remaining days
 */
export function determineSlaStatus(daysRemaining: number): SLAStatus {
  if (daysRemaining > 5) {
    return 'ON_TIME';
  } else if (daysRemaining > 0 && daysRemaining <= 5) {
    return 'DUE_SOON';
  } else {
    return 'OVERDUE';
  }
}

/**
 * Gets SLA info for a case
 */
export function getSlaInfo(slaDate: string | Date | null): SLAInfo {
  if (!slaDate) {
    return {
      status: 'ON_TIME',
      days_remaining: 999,
      color: 'green',
      icon: '🟢',
      text: 'Sin SLA definido',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const slaDateObj = typeof slaDate === 'string' ? new Date(slaDate) : slaDate;
  slaDateObj.setHours(0, 0, 0, 0);

  const daysRemaining = daysBetween(today, slaDateObj);
  const status = determineSlaStatus(daysRemaining);

  let color = 'gray';
  let icon = '⚪';
  let text = 'Sin información';

  switch (status) {
    case 'ON_TIME':
      color = 'green';
      icon = '🟢';
      text = `En tiempo (${daysRemaining} días)`;
      break;
    case 'DUE_SOON':
      color = 'yellow';
      icon = '🟡';
      text = `Por vencer (${daysRemaining} días)`;
      break;
    case 'OVERDUE':
      color = 'red';
      icon = '🔴';
      const daysOverdue = Math.abs(daysRemaining);
      text = `Vencido (hace ${daysOverdue} ${daysOverdue === 1 ? 'día' : 'días'})`;
      break;
  }

  return {
    status,
    days_remaining: daysRemaining,
    color,
    icon,
    text,
  };
}

/**
 * Checks if a case should be auto-moved to trash
 * (vencido + sin actualización por 7 días)
 */
export function shouldAutoTrash(
  slaDate: string | Date,
  updatedAt: string | Date
): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const slaDateObj = typeof slaDate === 'string' ? new Date(slaDate) : slaDate;
  slaDateObj.setHours(0, 0, 0, 0);

  const updatedAtObj = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  updatedAtObj.setHours(0, 0, 0, 0);

  const daysRemaining = daysBetween(today, slaDateObj);
  const daysSinceUpdate = daysBetween(updatedAtObj, today);

  // Vencido (daysRemaining < 0) AND sin actualización por 7 días
  return daysRemaining < 0 && daysSinceUpdate >= 7;
}

/**
 * Checks if case needs reminder (5 days before due date)
 */
export function needsReminder(slaDate: string | Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const slaDateObj = typeof slaDate === 'string' ? new Date(slaDate) : slaDate;
  slaDateObj.setHours(0, 0, 0, 0);

  const daysRemaining = daysBetween(today, slaDateObj);

  return daysRemaining === 5;
}

/**
 * Formats SLA date for display
 */
export function formatSlaDate(slaDate: string | Date | null): string {
  if (!slaDate) return 'Sin fecha';

  const dateObj = typeof slaDate === 'string' ? new Date(slaDate) : slaDate;

  return dateObj.toLocaleDateString('es-PA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Gets CSS classes for SLA badge
 */
export function getSlaClasses(status: SLAStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'ON_TIME':
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-300',
      };
    case 'DUE_SOON':
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-300',
      };
    case 'OVERDUE':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-300',
      };
  }
}
