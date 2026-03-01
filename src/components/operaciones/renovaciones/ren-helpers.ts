import type { OpsCaseStatus } from '@/types/operaciones.types';

// ════════════════════════════════════════════
// RENOVACIONES — Shared helpers
// ════════════════════════════════════════════

export interface MasterUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export interface Counts extends Record<string, number> {
  total_active: number;
  sla_breached: number;
  no_first_response: number;
}

export type FilterKey =
  | 'all'
  | 'sla_breached'
  | 'aplazado'
  | 'no_first_response'
  | 'assigned_to_me'
  | OpsCaseStatus;

// ── Controlled transitions ──
export const VALID_TRANSITIONS: Record<string, OpsCaseStatus[]> = {
  pendiente: ['en_revision'],
  en_revision: ['aplazado', 'cerrado_renovado', 'cerrado_cancelado'],
  aplazado: ['en_revision'],
};

// ── Formatters ──
export const fmtRelative = (d: string | null) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

export const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('es-PA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export const fmtDateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleString('es-PA', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '—';

export const addOneYear = (d: string) => {
  const dt = new Date(d);
  dt.setFullYear(dt.getFullYear() + 1);
  return dt.toISOString().slice(0, 10);
};

export const hoursElapsed = (d: string | null) => {
  if (!d) return Infinity;
  return (Date.now() - new Date(d).getTime()) / 3600000;
};
