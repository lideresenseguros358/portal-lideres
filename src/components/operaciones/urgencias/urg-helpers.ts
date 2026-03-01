import type { OpsCaseStatus } from '@/types/operaciones.types';

// ════════════════════════════════════════════
// URGENCIAS — Shared helpers
// ════════════════════════════════════════════

export interface MasterUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export interface UrgCounts extends Record<string, number> {
  total_active: number;
  sla_breached: number;
  no_first_response: number;
  pendiente: number;
  en_atencion: number;
  resuelto: number;
  cerrado: number;
}

export type UrgFilterKey =
  | 'all'
  | 'sla_breached'
  | 'no_first_response'
  | 'assigned_to_me'
  | 'today'
  | OpsCaseStatus;

// ── Controlled transitions (urgencias) ──
// pendiente → en_atencion
// en_atencion → resuelto | cerrado (requires note)
// resuelto → cerrado
// CANNOT close from pendiente directly
export const URG_VALID_TRANSITIONS: Record<string, OpsCaseStatus[]> = {
  pendiente: ['en_atencion'],
  en_atencion: ['resuelto', 'cerrado'],
  resuelto: ['cerrado'],
};

// Transitions that REQUIRE a mandatory note
export const NOTE_REQUIRED_TRANSITIONS: OpsCaseStatus[] = ['cerrado'];

// ── Business-hours SLA calculation (24h hábil, Mon-Fri) ──
export function calcBusinessHours(from: string | Date, to?: string | Date): number {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  let hours = 0;
  const cursor = new Date(start);

  while (cursor < end) {
    const day = cursor.getDay(); // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6) {
      // Business day — add up to 1 hour
      const next = new Date(cursor.getTime() + 3600000);
      if (next <= end) {
        hours += 1;
      } else {
        hours += (end.getTime() - cursor.getTime()) / 3600000;
      }
    }
    cursor.setTime(cursor.getTime() + 3600000);
  }

  return Math.round(hours * 10) / 10;
}

export function slaStatus(businessHours: number): 'ok' | 'warning' | 'critical' | 'breached' {
  if (businessHours >= 24) return 'breached';
  if (businessHours >= 20) return 'critical';
  if (businessHours >= 12) return 'warning';
  return 'ok';
}

export function slaLabel(status: ReturnType<typeof slaStatus>): string {
  switch (status) {
    case 'breached': return 'VENCIDO';
    case 'critical': return 'CRÍTICO';
    case 'warning': return 'ALERTA';
    case 'ok': return 'OK';
  }
}

export function slaColor(status: ReturnType<typeof slaStatus>) {
  switch (status) {
    case 'breached': return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
    case 'critical': return { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' };
    case 'warning': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'ok': return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
  }
}

// ── Deep link to ADM COT chat ──
export function buildChatDeepLink(chatThreadId: string | null, metadata?: Record<string, any>): string | null {
  if (metadata?.adm_cot_chat_url) return metadata.adm_cot_chat_url;
  if (metadata?.adm_cot_chat_id) return `/adm-cot/chats?thread=${metadata.adm_cot_chat_id}`;
  if (chatThreadId) return `/adm-cot/chats?thread=${chatThreadId}`;
  return null;
}

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
    ? new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export const fmtDateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

export const hoursElapsed = (d: string | null) => {
  if (!d) return Infinity;
  return (Date.now() - new Date(d).getTime()) / 3600000;
};

export interface OpsNote {
  id: string;
  case_id: string;
  user_id: string | null;
  note: string;
  note_type: string;
  created_at: string;
  user_name?: string;
}
