// ════════════════════════════════════════════
// EQUIPO — Shared helpers & types
// ════════════════════════════════════════════

export type PeriodFilter = 'day' | 'week' | 'month' | 'year';

export interface MasterCard {
  id: string;
  full_name: string;
  email: string;
  open_cases: number;
  sla_breached: number;
  hours_today: number;
  cases_today: number;
  unproductive_days_30d: number;
}

export interface DailyMetricRow {
  date: string;
  hours_worked: number;
  cases_handled: number;
  renewals_handled: number;
  petitions_handled: number;
  urgencies_handled: number;
  emissions_confirmed: number;
  conversions_count: number;
  sla_breaches: number;
  unresolved_cases: number;
  productivity_score: number;
  low_productivity: boolean;
}

export interface UserSummary {
  total_hours: number;
  days_with_data: number;
  avg_daily_hours: number;
  cases_handled: number;
  renewals_handled: number;
  petitions_handled: number;
  urgencies_handled: number;
  emissions_confirmed: number;
  conversions_count: number;
  sla_breaches: number;
  conversion_rate: number;
  unattended_cases: number;
  pending_cases: number;
  avg_response_hours: number;
  urgencies_total: number;
  urgencies_within_sla: number;
  urgencies_breached: number;
  urgency_effectiveness: number;
  ai_effectiveness_avg: number;
  ai_negative_count: number;
  ai_total_evaluated: number;
}

export interface ProductivityFlag {
  id: string;
  date: string;
  low_productivity: boolean;
  monthly_avg_cases: number;
  actual_cases: number;
  threshold_pct: number;
  note: string | null;
}

export interface PreviousPeriod {
  petitions: number;
  conversions: number;
  conversion_rate: number;
}

export interface HistoryEntry {
  id: string;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
}

export type ModalTab = 'resumen' | 'productividad' | 'sla' | 'conversion' | 'urgencias' | 'historial';

// ── Period range calculator ──
export function getPeriodRange(period: PeriodFilter, refDate?: Date): { from: string; to: string; label: string } {
  const d = refDate || new Date();
  const panama = new Date(d.toLocaleString('en-US', { timeZone: 'America/Panama' }));
  const y = panama.getFullYear();
  const m = panama.getMonth();
  const day = panama.getDate();
  const dow = panama.getDay(); // 0=Sun

  switch (period) {
    case 'day': {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { from: iso, to: iso, label: `Hoy (${iso})` };
    }
    case 'week': {
      // Monday start
      const diffToMon = dow === 0 ? 6 : dow - 1;
      const mon = new Date(panama);
      mon.setDate(day - diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const f = mon.toISOString().slice(0, 10);
      const t = sun.toISOString().slice(0, 10);
      return { from: f, to: t, label: `Semana ${f} – ${t}` };
    }
    case 'month': {
      const f = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const t = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return { from: f, to: t, label: `${monthNames[m]} ${y}` };
    }
    case 'year': {
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Año ${y}` };
    }
  }
}

// ── Formatters ──
export const fmtHours = (h: number) => {
  if (h === 0) return '0h';
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
};

export const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: 'short' });

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' });

// ── Action labels for history ──
export const ACTION_LABELS: Record<string, string> = {
  status_change: 'Cambio de estado',
  case_assigned: 'Reasignación',
  petition_converted_to_emission: 'Conversión a emisión',
  cancellation_confirmed: 'Cancelación confirmada',
  renewal_confirmed: 'Renovación confirmada',
  email_sent: 'Correo enviado',
  first_response: 'Primera respuesta',
};

export const ACTION_COLORS: Record<string, string> = {
  status_change: 'bg-blue-100 text-blue-700',
  case_assigned: 'bg-purple-100 text-purple-700',
  petition_converted_to_emission: 'bg-green-100 text-green-700',
  cancellation_confirmed: 'bg-red-100 text-red-700',
  renewal_confirmed: 'bg-emerald-100 text-emerald-700',
  email_sent: 'bg-teal-100 text-teal-700',
  first_response: 'bg-amber-100 text-amber-700',
};

// ── Initials from name ──
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}
