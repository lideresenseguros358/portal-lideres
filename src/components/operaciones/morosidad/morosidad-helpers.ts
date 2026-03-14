import type { OpsMorosidadStatus, OpsMorosidadRow } from '@/types/operaciones.types';

// ════════════════════════════════════════════
// MOROSIDAD — Shared helpers
// ════════════════════════════════════════════

export interface MorosidadCounts {
  [key: string]: number;
  total: number;
  al_dia: number;
  atrasado: number;
  pago_recibido: number;
  cancelado: number;
}

export type MorosidadFilterKey = 'all' | OpsMorosidadStatus | 'overdue_30' | 'recurring' | 'contado' | 'assigned_to_me';

export const STATUS_CONFIG: Record<OpsMorosidadStatus, { label: string; bg: string; text: string; dot: string }> = {
  al_dia: { label: 'Al Día', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  atrasado: { label: 'Atrasado', bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
  pago_recibido: { label: 'Pago Recibido', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  cancelado: { label: 'Cancelado', bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' },
};

// ── Merge engine ──

export const MERGE_VARS = [
  '{{cliente_nombre}}',
  '{{poliza_numero}}',
  '{{ramo}}',
  '{{monto_adeudado}}',
  '{{dias_atraso}}',
  '{{fecha_vencimiento}}',
] as const;

export const DEFAULT_SUBJECT = 'Aviso de morosidad - {{poliza_numero}}';

export const DEFAULT_BODY = `Estimado/a {{cliente_nombre}},

Le informamos que su póliza {{poliza_numero}} correspondiente al ramo {{ramo}} presenta un saldo pendiente de {{monto_adeudado}} con {{dias_atraso}} días de atraso.

Le agradecemos realizar su pago a la mayor brevedad posible.

Saludos,
Líderes en Seguros`;

export function mergePlaceholders(template: string, row: OpsMorosidadRow): string {
  return template
    .replace(/\{\{cliente_nombre\}\}/g, row.client_name || 'Cliente')
    .replace(/\{\{poliza_numero\}\}/g, row.policy_number || '—')
    .replace(/\{\{ramo\}\}/g, row.ramo || 'N/A')
    .replace(/\{\{monto_adeudado\}\}/g, fmtCurrency(row.payment_amount || row.installment_amount || 0))
    .replace(/\{\{dias_atraso\}\}/g, String(row.days_overdue || 0))
    .replace(/\{\{fecha_vencimiento\}\}/g, fmtDate(row.renewal_date));
}

// ── Formatters ──

export function fmtCurrency(n: number | null): string {
  if (n === null || n === undefined) return '$0.00';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' });
}

// ── Badge helpers ──

export function daysOverdueSeverity(days: number): 'ok' | 'warning' | 'critical' {
  if (days >= 30) return 'critical';
  if (days > 0) return 'warning';
  return 'ok';
}

export function daysOverdueColor(severity: ReturnType<typeof daysOverdueSeverity>) {
  switch (severity) {
    case 'critical': return { bg: 'bg-red-100', text: 'text-red-700' };
    case 'warning': return { bg: 'bg-amber-100', text: 'text-amber-700' };
    case 'ok': return { bg: 'bg-green-100', text: 'text-green-700' };
  }
}

// ── Build morosidad email HTML ──

const PAYMENT_URL = 'https://portal.lideresenseguros.com/cotizadores?pagar=true';

export function buildMorosidadEmailHtml(body: string, row: OpsMorosidadRow): string {
  const merged = mergePlaceholders(body, row);
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
  <div style="max-width:640px;margin:0 auto;background:white;">
    <div style="background:#010139;color:white;padding:20px 24px;">
      <h1 style="margin:0;font-size:18px;">💰 Aviso de Morosidad</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Líderes en Seguros</p>
    </div>
    <div style="padding:24px;">
      ${merged.replace(/\n/g, '<br/>')}
    </div>
    <div style="padding:24px;text-align:center;">
      <a href="${PAYMENT_URL}" style="display:inline-block;padding:14px 36px;background:#8AAA19;color:white;text-decoration:none;font-weight:bold;font-size:16px;border-radius:10px;letter-spacing:0.3px;">Realizar mi pago</a>
      <p style="margin-top:10px;font-size:12px;color:#6b7280;">Haga clic en el botón para pagar sus cuotas pendientes de forma rápida y segura.</p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
      <p>Líderes en Seguros, S.A. | portal.lideresenseguros.com</p>
    </div>
  </div>
</body></html>`;
}
