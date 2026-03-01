import type { OpsCaseStatus } from '@/types/operaciones.types';

// ════════════════════════════════════════════
// PETICIONES — Shared helpers
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
  | 'no_first_response'
  | 'assigned_to_me'
  | OpsCaseStatus;

// ── Controlled transitions ──
export const VALID_TRANSITIONS: Record<string, OpsCaseStatus[]> = {
  pendiente: ['en_gestion'],
  en_gestion: ['enviado', 'perdido'],
  enviado: ['cerrado', 'perdido'],
};

// ── Ramo labels ──
export const RAMO_LABELS: Record<string, string> = {
  vida: 'Vida',
  incendio: 'Incendio',
  hogar: 'Hogar',
};

export const RAMO_COLORS: Record<string, { bg: string; text: string }> = {
  vida: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  incendio: { bg: 'bg-orange-100', text: 'text-orange-700' },
  hogar: { bg: 'bg-teal-100', text: 'text-teal-700' },
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

export const hoursElapsed = (d: string | null) => {
  if (!d) return Infinity;
  return (Date.now() - new Date(d).getTime()) / 3600000;
};
