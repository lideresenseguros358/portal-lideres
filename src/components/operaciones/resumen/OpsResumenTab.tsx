'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FaSync,
  FaExclamationTriangle,
  FaInbox,
  FaMoneyBillWave,
  FaUsers,
  FaClock,
  FaCheckCircle,
  FaBolt,
} from 'react-icons/fa';

interface Counters {
  renovaciones_pendientes: number;
  peticiones_abiertas: number;
  urgencias_activas: number;
  morosidad: number;
  equipo_activo: number;
  sla_vencidos: number;
  cerrados_hoy: number;
  horas_equipo_hoy: number;
}

interface RenovacionProxima {
  id: string;
  ticket: string;
  client_name: string | null;
  insurer_name: string | null;
  policy_number: string | null;
  renewal_date: string | null;
  status: string;
}

interface UrgenciaReciente {
  id: string;
  ticket: string;
  client_name: string | null;
  insurer_name: string | null;
  status: string;
  created_at: string;
  sla_breached: boolean;
}

interface ActivityEntry {
  id: string;
  user_name: string | null;
  action_type: string;
  entity_type: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
}

const ACTION_LABELS: Record<string, string> = {
  status_change: 'Cambio estado',
  case_assigned: 'Reasignación',
  case_created: 'Caso creado',
  renewal_confirmed: 'Renovación confirmada',
  cancellation_confirmed: 'Cancelación',
  email_sent: 'Correo enviado',
  first_response: '1a respuesta',
  check_payment_created: 'Pago registrado',
  check_payment_paid: 'Pago conciliado',
  check_payment_deleted: 'Pago eliminado',
  check_payment_updated: 'Pago editado',
  check_bank_imported: 'Banco importado',
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  esperando_cliente: 'Esperando cliente',
  esperando_aseguradora: 'Esperando aseg.',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: 'short' });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });
}

function daysUntil(d: string | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
}

export default function OpsResumenTab() {
  const [loading, setLoading] = useState(true);
  const [counters, setCounters] = useState<Counters | null>(null);
  const [renProximas, setRenProximas] = useState<RenovacionProxima[]>([]);
  const [urgRecientes, setUrgRecientes] = useState<UrgenciaReciente[]>([]);
  const [actividad, setActividad] = useState<ActivityEntry[]>([]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/operaciones/dashboard');
      if (!res.ok) return;
      const data = await res.json();
      setCounters(data.counters || null);
      setRenProximas(data.renovaciones_proximas || []);
      setUrgRecientes(data.urgencias_recientes || []);
      setActividad(data.actividad_hoy || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const cards = counters ? [
    { label: 'Renovaciones Pendientes', value: counters.renovaciones_pendientes, icon: FaSync, bg: 'bg-blue-50', border: 'border-blue-200', color: 'text-blue-600' },
    { label: 'Peticiones Abiertas', value: counters.peticiones_abiertas, icon: FaInbox, bg: 'bg-purple-50', border: 'border-purple-200', color: 'text-purple-600' },
    { label: 'Urgencias Activas', value: counters.urgencias_activas, icon: FaExclamationTriangle, bg: 'bg-red-50', border: 'border-red-200', color: 'text-red-600' },
    { label: 'Morosidad', value: counters.morosidad, icon: FaMoneyBillWave, bg: 'bg-amber-50', border: 'border-amber-200', color: 'text-amber-600' },
    { label: 'Equipo Activo', value: counters.equipo_activo, icon: FaUsers, bg: 'bg-green-50', border: 'border-green-200', color: 'text-green-600' },
    { label: 'SLA Vencidos', value: counters.sla_vencidos, icon: FaClock, bg: 'bg-orange-50', border: 'border-orange-200', color: 'text-orange-600', alert: counters.sla_vencidos > 0 },
    { label: 'Cerrados Hoy', value: counters.cerrados_hoy, icon: FaCheckCircle, bg: 'bg-emerald-50', border: 'border-emerald-200', color: 'text-emerald-600' },
    { label: 'Horas Equipo Hoy', value: counters.horas_equipo_hoy > 0 ? `${counters.horas_equipo_hoy}h` : '0h', icon: FaClock, bg: 'bg-indigo-50', border: 'border-indigo-200', color: 'text-indigo-600' },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/3" />
            </div>
          ))
        ) : (
          cards.map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-3 sm:p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`text-sm ${c.color}`} />
                  <p className={`text-[10px] ${c.color} font-semibold uppercase`}>{c.label}</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-[#010139]">{c.value}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Data sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Renovaciones Próximas */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h3 className="text-sm font-bold text-[#010139] mb-3 flex items-center gap-2">
            <FaSync className="text-blue-500 text-xs" />
            Renovaciones Próximas
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : renProximas.length === 0 ? (
            <div className="py-6 text-center">
              <FaSync className="text-2xl text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Sin renovaciones pendientes</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {renProximas.map(r => {
                const days = daysUntil(r.renewal_date);
                const urgent = days !== null && days <= 7;
                return (
                  <div key={r.id} className={`flex items-center justify-between p-2.5 rounded-lg ${urgent ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#010139] truncate">{r.client_name || r.ticket}</p>
                      <p className="text-[10px] text-gray-500 truncate">{r.insurer_name}{r.policy_number ? ` · ${r.policy_number}` : ''}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className={`text-[10px] font-bold ${urgent ? 'text-red-600' : 'text-gray-600'}`}>{fmtDate(r.renewal_date)}</p>
                      {days !== null && (
                        <p className={`text-[9px] ${urgent ? 'text-red-500' : 'text-gray-400'}`}>
                          {days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `en ${days}d`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Urgencias Recientes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h3 className="text-sm font-bold text-[#010139] mb-3 flex items-center gap-2">
            <FaExclamationTriangle className="text-red-500 text-xs" />
            Urgencias Recientes
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : urgRecientes.length === 0 ? (
            <div className="py-6 text-center">
              <FaExclamationTriangle className="text-2xl text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Sin urgencias activas</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {urgRecientes.map(u => (
                <div key={u.id} className={`flex items-center justify-between p-2.5 rounded-lg ${u.sla_breached ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {u.sla_breached && <FaBolt className="text-red-500 text-[9px] flex-shrink-0" />}
                      <p className="text-xs font-semibold text-[#010139] truncate">{u.client_name || u.ticket}</p>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{u.insurer_name || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      u.sla_breached ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {STATUS_LABELS[u.status] || u.status}
                    </span>
                    <p className="text-[9px] text-gray-400 mt-0.5">{fmtDate(u.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actividad del Equipo Hoy */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <h3 className="text-sm font-bold text-[#010139] mb-3 flex items-center gap-2">
          <FaUsers className="text-[#8AAA19] text-xs" />
          Actividad del Equipo Hoy
        </h3>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-50 rounded-lg animate-pulse" />)}
          </div>
        ) : actividad.length === 0 ? (
          <div className="py-6 text-center">
            <FaUsers className="text-2xl text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Sin actividad registrada hoy</p>
          </div>
        ) : (
          <div className="space-y-1">
            {actividad.map(a => {
              const label = ACTION_LABELS[a.action_type] || a.action_type;
              const meta = a.metadata || {};
              let detail = '';
              if (meta.client_name) detail = meta.client_name;
              else if (meta.ticket) detail = meta.ticket;
              else if (meta.from && meta.to) detail = `${meta.from} → ${meta.to}`;
              if (meta.amount) detail += detail ? ` · $${Number(meta.amount).toFixed(2)}` : `$${Number(meta.amount).toFixed(2)}`;

              return (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#8AAA19] flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#010139]">
                      <span className="font-semibold">{a.user_name || 'Sistema'}</span>
                      {' — '}
                      <span className="text-gray-600">{label}</span>
                      {detail && <span className="text-gray-400"> · {detail}</span>}
                    </p>
                  </div>
                  <span className="text-[9px] text-gray-400 flex-shrink-0 tabular-nums">{fmtTime(a.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
