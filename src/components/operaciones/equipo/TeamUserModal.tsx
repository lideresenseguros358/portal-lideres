'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FaTimes, FaClock, FaChartLine, FaExclamationTriangle, FaCheckCircle,
  FaTimesCircle, FaSync, FaInbox, FaBolt, FaHistory, FaUser,
  FaArrowUp, FaArrowDown, FaMinus,
} from 'react-icons/fa';
import type {
  PeriodFilter, ModalTab, MasterCard, DailyMetricRow, UserSummary,
  ProductivityFlag, PreviousPeriod, HistoryEntry,
} from './team-helpers';
import {
  getPeriodRange, fmtHours, fmtPct, fmtDate, fmtDateTime,
  ACTION_LABELS, ACTION_COLORS, getInitials,
} from './team-helpers';

interface Props {
  card: MasterCard;
  onClose: () => void;
}

const TABS: { key: ModalTab; label: string; icon: typeof FaChartLine }[] = [
  { key: 'resumen', label: 'Resumen', icon: FaChartLine },
  { key: 'productividad', label: 'Productividad', icon: FaClock },
  { key: 'sla', label: 'SLA', icon: FaExclamationTriangle },
  { key: 'conversion', label: 'Conversión', icon: FaCheckCircle },
  { key: 'urgencias', label: 'Urgencias', icon: FaBolt },
  { key: 'historial', label: 'Historial', icon: FaHistory },
];

const PERIODS: { key: PeriodFilter; label: string }[] = [
  { key: 'day', label: 'Día' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
];

export default function TeamUserModal({ card, onClose }: Props) {
  const [tab, setTab] = useState<ModalTab>('resumen');
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [loading, setLoading] = useState(true);

  // Data
  const [daily, setDaily] = useState<DailyMetricRow[]>([]);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [flags, setFlags] = useState<ProductivityFlag[]>([]);
  const [prevPeriod, setPrevPeriod] = useState<PreviousPeriod | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Fetch detail data
  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getPeriodRange(period);
      const res = await fetch(
        `/api/operaciones/team?view=detail&user_id=${card.id}&from=${from}&to=${to}`
      );
      const json = await res.json();
      setDaily(json.daily || []);
      setSummary(json.summary || null);
      setFlags(json.productivity_flags || []);
      setPrevPeriod(json.previous_period || null);
    } catch { /* silent */ }
    setLoading(false);
  }, [card.id, period]);

  // Fetch history (lazy)
  const fetchHistory = useCallback(async () => {
    if (historyLoaded) return;
    try {
      const { from, to } = getPeriodRange(period);
      const res = await fetch(
        `/api/operaciones/team?view=history&user_id=${card.id}&from=${from}&to=${to}`
      );
      const json = await res.json();
      setHistory(json.history || []);
      setHistoryLoaded(true);
    } catch { /* silent */ }
  }, [card.id, period, historyLoaded]);

  useEffect(() => {
    fetchDetail();
    setHistoryLoaded(false);
  }, [fetchDetail]);

  useEffect(() => {
    if (tab === 'historial') fetchHistory();
  }, [tab, fetchHistory]);

  // Log view
  useEffect(() => {
    fetch('/api/operaciones/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log_view', user_id: card.id }),
    }).catch(() => {});
  }, [card.id]);

  const { label: periodLabel } = getPeriodRange(period);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-[#010139] to-[#020270]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {getInitials(card.full_name)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{card.full_name}</h2>
              <p className="text-xs text-white/60">{card.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1">
            <FaTimes size={18} />
          </button>
        </div>

        {/* Period filter + Tabs */}
        <div className="px-5 pt-3 pb-0 space-y-3 border-b border-gray-100">
          {/* Period */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Periodo:</span>
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    period === p.key
                      ? 'bg-[#010139] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-gray-400 ml-auto">{periodLabel}</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto -mb-px">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap border-b-2 ${
                    tab === t.key
                      ? 'border-[#8AAA19] text-[#010139] bg-[#8AAA19]/10'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {tab === 'resumen' && summary && <TabResumen summary={summary} />}
              {tab === 'productividad' && <TabProductividad daily={daily} flags={flags} />}
              {tab === 'sla' && summary && <TabSLA summary={summary} />}
              {tab === 'conversion' && summary && prevPeriod && (
                <TabConversion summary={summary} daily={daily} prevPeriod={prevPeriod} />
              )}
              {tab === 'urgencias' && summary && <TabUrgencias summary={summary} />}
              {tab === 'historial' && <TabHistorial history={history} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// SUB-COMPONENTS: Tab content panels
// ════════════════════════════════════════════

function MetricBox({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: typeof FaClock; color?: string; sub?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3.5 flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color || 'bg-[#010139]/10'}`}>
        <Icon className={`text-sm ${color ? 'text-white' : 'text-[#010139]'}`} />
      </div>
      <div>
        <p className="text-[10px] text-gray-500 font-medium leading-none mb-1">{label}</p>
        <p className="text-lg font-bold text-[#010139] leading-none">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── RESUMEN ──
function TabResumen({ summary }: { summary: UserSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <MetricBox label="Horas Trabajadas" value={fmtHours(summary.total_hours)} icon={FaClock}
        sub={`Prom: ${fmtHours(summary.avg_daily_hours)}/día`} />
      <MetricBox label="Casos Manejados" value={summary.cases_handled} icon={FaCheckCircle} />
      <MetricBox label="Renovaciones" value={summary.renewals_handled} icon={FaSync} />
      <MetricBox label="Peticiones" value={summary.petitions_handled} icon={FaInbox} />
      <MetricBox label="Emisiones" value={summary.emissions_confirmed} icon={FaCheckCircle}
        color="bg-green-500" />
      <MetricBox label="Conversión" value={fmtPct(summary.conversion_rate)} icon={FaChartLine}
        color="bg-[#8AAA19]" />
      <MetricBox label="SLA Breaches" value={summary.sla_breaches} icon={FaExclamationTriangle}
        color={summary.sla_breaches > 0 ? 'bg-red-500' : undefined} />
      <MetricBox label="No Atendidos (>48h)" value={summary.unattended_cases} icon={FaTimesCircle}
        color={summary.unattended_cases > 0 ? 'bg-amber-500' : undefined} />
      <MetricBox label="Prom. 1a Respuesta" value={`${summary.avg_response_hours}h`} icon={FaClock}
        color={summary.avg_response_hours > 48 ? 'bg-red-500' : undefined}
        sub={summary.avg_response_hours > 48 ? 'Excede 48h' : undefined} />
      <MetricBox label="Pendientes Actuales" value={summary.pending_cases} icon={FaUser} />
    </div>
  );
}

// ── PRODUCTIVIDAD ──
function TabProductividad({ daily, flags }: { daily: DailyMetricRow[]; flags: ProductivityFlag[] }) {
  const flagDates = new Set(flags.map(f => f.date));
  const maxCases = Math.max(...daily.map(d => d.cases_handled), 1);
  const maxHours = Math.max(...daily.map(d => d.hours_worked), 1);

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h4 className="text-xs font-bold text-[#010139] mb-3">Casos & Horas por Día</h4>
        {daily.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Sin datos en este periodo</p>
        ) : (
          <div className="flex items-end gap-1 h-40 overflow-x-auto">
            {daily.map(d => {
              const isFlag = flagDates.has(d.date);
              const casesH = (d.cases_handled / maxCases) * 100;
              const hoursH = (d.hours_worked / maxHours) * 100;
              return (
                <div key={d.date} className="flex flex-col items-center gap-0.5 min-w-[28px] flex-shrink-0">
                  <div className="flex gap-0.5 items-end h-28">
                    <div
                      className={`w-3 rounded-t transition-all ${isFlag ? 'bg-red-400' : 'bg-[#010139]'}`}
                      style={{ height: `${Math.max(casesH, 4)}%` }}
                      title={`${d.cases_handled} casos`}
                    />
                    <div
                      className="w-3 rounded-t bg-[#8AAA19]"
                      style={{ height: `${Math.max(hoursH, 4)}%` }}
                      title={`${d.hours_worked}h`}
                    />
                  </div>
                  <span className={`text-[8px] ${isFlag ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                    {d.date.slice(8)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#010139] rounded-sm" /> Casos</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#8AAA19] rounded-sm" /> Horas</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-sm" /> Día improductivo</span>
        </div>
      </div>

      {/* Flags list */}
      {flags.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-red-600 flex items-center gap-1.5">
            <FaExclamationTriangle className="text-xs" />
            Días Improductivos ({flags.length})
          </h4>
          {flags.map(f => (
            <div key={f.id} className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-red-700">{fmtDate(f.date)}</p>
                <p className="text-[10px] text-red-500">
                  Casos: {f.actual_cases} (prom. esperado: {f.monthly_avg_cases.toFixed(1)})
                </p>
              </div>
              <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                {f.threshold_pct}% bajo promedio
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SLA ──
function TabSLA({ summary }: { summary: UserSummary }) {
  const avgBad = summary.avg_response_hours > 48;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricBox label="SLA Vencidos" value={summary.sla_breaches} icon={FaExclamationTriangle}
          color={summary.sla_breaches > 0 ? 'bg-red-500' : undefined} />
        <MetricBox label="Prom. 1a Respuesta" value={`${summary.avg_response_hours}h`} icon={FaClock}
          color={avgBad ? 'bg-red-500' : 'bg-green-500'} />
        <MetricBox label="No Atendidos (>48h)" value={summary.unattended_cases} icon={FaTimesCircle}
          color={summary.unattended_cases > 0 ? 'bg-amber-500' : undefined} />
        <MetricBox label="Urgencias dentro SLA" value={summary.urgencies_within_sla} icon={FaCheckCircle}
          color="bg-green-500" />
        <MetricBox label="Urgencias fuera SLA" value={summary.urgencies_breached} icon={FaTimesCircle}
          color={summary.urgencies_breached > 0 ? 'bg-red-500' : undefined} />
      </div>

      {avgBad && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">Tiempo de respuesta excede 48h</p>
            <p className="text-xs text-red-500">
              Promedio actual: {summary.avg_response_hours}h — Umbral: 48h
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CONVERSIÓN ──
function TabConversion({ summary, daily, prevPeriod }: {
  summary: UserSummary; daily: DailyMetricRow[]; prevPeriod: PreviousPeriod;
}) {
  const rateDelta = summary.conversion_rate - prevPeriod.conversion_rate;
  const trend = rateDelta > 0 ? 'up' : rateDelta < 0 ? 'down' : 'flat';
  const maxBar = Math.max(summary.petitions_handled, summary.conversions_count, 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricBox label="Peticiones Recibidas" value={summary.petitions_handled} icon={FaInbox} />
        <MetricBox label="Emisiones Logradas" value={summary.conversions_count} icon={FaCheckCircle}
          color="bg-green-500" />
        <MetricBox label="Conversión" value={fmtPct(summary.conversion_rate)} icon={FaChartLine}
          color="bg-[#8AAA19]" />
        <div className="bg-gray-50 rounded-xl p-3.5">
          <p className="text-[10px] text-gray-500 font-medium mb-1">Tendencia vs Anterior</p>
          <div className="flex items-center gap-1.5">
            {trend === 'up' && <FaArrowUp className="text-green-500" />}
            {trend === 'down' && <FaArrowDown className="text-red-500" />}
            {trend === 'flat' && <FaMinus className="text-gray-400" />}
            <span className={`text-lg font-bold ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {rateDelta > 0 ? '+' : ''}{rateDelta.toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] text-gray-400">Anterior: {fmtPct(prevPeriod.conversion_rate)}</p>
        </div>
      </div>

      {/* Bar chart: Petitions vs Emissions */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h4 className="text-xs font-bold text-[#010139] mb-3">Peticiones vs Emisiones</h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>Peticiones</span>
              <span>{summary.petitions_handled}</span>
            </div>
            <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#010139] rounded-full transition-all"
                style={{ width: `${(summary.petitions_handled / maxBar) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>Emisiones</span>
              <span>{summary.conversions_count}</span>
            </div>
            <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8AAA19] rounded-full transition-all"
                style={{ width: `${(summary.conversions_count / maxBar) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Previous period comparison */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <p className="text-xs font-semibold text-blue-700 mb-1">Periodo Anterior</p>
        <div className="flex gap-4 text-xs text-blue-600">
          <span>Peticiones: {prevPeriod.petitions}</span>
          <span>Emisiones: {prevPeriod.conversions}</span>
          <span>Conversión: {fmtPct(prevPeriod.conversion_rate)}</span>
        </div>
      </div>
    </div>
  );
}

// ── URGENCIAS ──
function TabUrgencias({ summary }: { summary: UserSummary }) {
  const lowEffectiveness = summary.urgency_effectiveness < 70 && summary.urgencies_total > 0;
  const lowAiEff = summary.ai_effectiveness_avg > 0 && summary.ai_effectiveness_avg < 70;
  const hasAiData = summary.ai_total_evaluated > 0;
  const negPct = summary.ai_total_evaluated > 0
    ? Math.round((summary.ai_negative_count / summary.ai_total_evaluated) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricBox label="Total Urgencias" value={summary.urgencies_total} icon={FaBolt} />
        <MetricBox label="Prom. 1a Respuesta" value={`${summary.avg_response_hours}h`} icon={FaClock} />
        <MetricBox label="Dentro de SLA" value={summary.urgencies_within_sla} icon={FaCheckCircle}
          color="bg-green-500" />
        <MetricBox label="Fuera de SLA" value={summary.urgencies_breached} icon={FaTimesCircle}
          color={summary.urgencies_breached > 0 ? 'bg-red-500' : undefined} />
        <MetricBox label="% Dentro SLA" value={`${summary.urgency_effectiveness}%`} icon={FaCheckCircle}
          color={lowEffectiveness ? 'bg-red-500' : 'bg-green-500'}
          sub="Resueltas dentro de SLA" />
      </div>

      {/* AI Effectiveness Section */}
      {hasAiData && (
        <div className="border border-[#010139]/10 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#010139] to-[#020270] px-4 py-2 flex items-center gap-2">
            <FaBolt className="text-white text-xs" />
            <span className="text-xs font-bold text-white">IA — Efectividad Real (Sentimiento)</span>
            <span className="ml-auto text-[10px] text-white/50">{summary.ai_total_evaluated} evaluados</span>
          </div>
          <div className="p-4 grid grid-cols-3 gap-3">
            <div className={`rounded-xl p-3 text-center ${lowAiEff ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className="text-[10px] text-gray-500 font-medium">Efectividad IA</p>
              <p className={`text-xl font-bold ${lowAiEff ? 'text-red-600' : 'text-green-600'}`}>
                {summary.ai_effectiveness_avg}%
              </p>
            </div>
            <div className={`rounded-xl p-3 text-center ${negPct > 30 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <p className="text-[10px] text-gray-500 font-medium">% Negativos</p>
              <p className={`text-xl font-bold ${negPct > 30 ? 'text-red-600' : 'text-[#010139]'}`}>
                {negPct}%
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 font-medium">Evaluados</p>
              <p className="text-xl font-bold text-[#010139]">{summary.ai_total_evaluated}</p>
            </div>
          </div>
        </div>
      )}

      {(lowEffectiveness || lowAiEff) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">Efectividad baja en urgencias</p>
            <p className="text-xs text-red-500">
              {lowAiEff
                ? `IA: ${summary.ai_effectiveness_avg}% — ${negPct}% con sentimiento negativo`
                : `Solo ${summary.urgency_effectiveness}% resueltas dentro de SLA`
              } — Meta: 70%+
            </p>
          </div>
        </div>
      )}

      {summary.urgencies_total === 0 && (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <FaBolt className="text-gray-300 text-2xl mx-auto mb-2" />
          <p className="text-xs text-gray-400">Sin urgencias en este periodo</p>
        </div>
      )}
    </div>
  );
}

// ── HISTORIAL ──
function TabHistorial({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <FaHistory className="text-gray-300 text-2xl mx-auto mb-2" />
        <p className="text-xs text-gray-400">Sin actividad registrada en este periodo</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />
      <div className="space-y-3">
        {history.map(h => {
          const label = ACTION_LABELS[h.action_type] || h.action_type;
          const colorClass = ACTION_COLORS[h.action_type] || 'bg-gray-100 text-gray-700';
          const meta = h.metadata || {};

          let detail = '';
          if (meta.from && meta.to) detail = `${meta.from} → ${meta.to}`;
          else if (meta.ticket) detail = meta.ticket;
          else if (meta.assigned_to) detail = `Asignado a: ${meta.assigned_to}`;
          else if (meta.reason) detail = meta.reason;

          return (
            <div key={h.id} className="flex gap-3 pl-2">
              <div className="w-5 h-5 rounded-full bg-white border-2 border-gray-300 flex-shrink-0 mt-1 z-10" />
              <div className="flex-1 bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colorClass}`}>
                    {label}
                  </span>
                  <span className="text-[10px] text-gray-400">{fmtDateTime(h.created_at)}</span>
                </div>
                {detail && <p className="text-xs text-gray-600">{detail}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
