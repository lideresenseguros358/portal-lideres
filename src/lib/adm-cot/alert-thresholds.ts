/**
 * ADM COT — Alert Thresholds (Semáforo)
 * 
 * Configurable thresholds for dashboard KPI alerts.
 * Green = OK, Yellow = Warning, Red = Critical
 */

export interface ThresholdConfig {
  label: string;
  greenMin: number;
  yellowMin: number;
  // Below yellowMin = red
  unit: '%' | '$' | '#';
  invertColor?: boolean; // true = higher is worse (e.g. errors)
}

export const ALERT_THRESHOLDS: Record<string, ThresholdConfig> = {
  conversionRate: {
    label: 'Tasa de Conversión',
    greenMin: 15,
    yellowMin: 8,
    unit: '%',
  },
  errorRate: {
    label: 'Tasa de Errores',
    greenMin: 5,   // <5% green
    yellowMin: 10,  // <10% yellow, >=10% red
    unit: '%',
    invertColor: true,
  },
  pendingPayments: {
    label: 'Pagos Pendientes',
    greenMin: 5,    // <=5 green
    yellowMin: 15,  // <=15 yellow, >15 red
    unit: '#',
    invertColor: true,
  },
  avgTimeToEmit: {
    label: 'Tiempo Promedio Emisión',
    greenMin: 30,   // <=30min green
    yellowMin: 120,  // <=120min yellow, >120min red
    unit: '#',
    invertColor: true,
  },
};

export type AlertLevel = 'green' | 'yellow' | 'red';

export function getAlertLevel(thresholdKey: string, value: number): AlertLevel {
  const config = ALERT_THRESHOLDS[thresholdKey];
  if (!config) return 'green';

  if (config.invertColor) {
    // Higher value = worse
    if (value <= config.greenMin) return 'green';
    if (value <= config.yellowMin) return 'yellow';
    return 'red';
  } else {
    // Higher value = better
    if (value >= config.greenMin) return 'green';
    if (value >= config.yellowMin) return 'yellow';
    return 'red';
  }
}

export function getAlertColor(level: AlertLevel): string {
  switch (level) {
    case 'green': return 'text-green-600';
    case 'yellow': return 'text-yellow-600';
    case 'red': return 'text-red-600';
  }
}

export function getAlertBgColor(level: AlertLevel): string {
  switch (level) {
    case 'green': return 'bg-green-50 border-green-200';
    case 'yellow': return 'bg-yellow-50 border-yellow-200';
    case 'red': return 'bg-red-50 border-red-200';
  }
}
