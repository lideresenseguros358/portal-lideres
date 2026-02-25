'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaFileAlt,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaBuilding,
  FaMoneyBillWave,
  FaUndoAlt,
  FaFilter,
  FaSync,
  FaFilePdf,
  FaFileExcel,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaPercent,
  FaBug,
} from 'react-icons/fa';
import { useDateRange } from '@/hooks/useAdmCot';
import { getAlertLevel, getAlertBgColor, getAlertColor } from '@/lib/adm-cot/alert-thresholds';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DashboardData } from '@/lib/adm-cot/dashboard-metrics';

// ════════════════════════════════════════════
// COLORS
// ════════════════════════════════════════════

const CHART_COLORS = ['#010139', '#8AAA19', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];
const PIE_COLORS = ['#010139', '#8AAA19', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

// ════════════════════════════════════════════
// KPI CARD
// ════════════════════════════════════════════

function KpiCard({
  label,
  value,
  icon,
  color = 'blue',
  subtitle,
  delta,
  alertKey,
  alertValue,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'indigo';
  subtitle?: string;
  delta?: number;
  alertKey?: string;
  alertValue?: number;
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-50 to-blue-100 border-blue-200',
    green: 'from-green-50 to-green-100 border-green-200',
    amber: 'from-amber-50 to-amber-100 border-amber-200',
    red: 'from-red-50 to-red-100 border-red-200',
    purple: 'from-purple-50 to-purple-100 border-purple-200',
    indigo: 'from-indigo-50 to-indigo-100 border-indigo-200',
  };
  const iconColorMap: Record<string, string> = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
    purple: 'text-purple-500',
    indigo: 'text-indigo-500',
  };

  const alertLevel = alertKey && alertValue !== undefined ? getAlertLevel(alertKey, alertValue) : null;

  return (
    <div className={`bg-gradient-to-br ${alertLevel ? getAlertBgColor(alertLevel) : colorMap[color]} border rounded-xl p-4 flex items-start gap-3 shadow-sm`}>
      <div className={`text-2xl mt-0.5 ${alertLevel ? getAlertColor(alertLevel) : iconColorMap[color]}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-[#010139] leading-tight">{value}</p>
          {delta !== undefined && delta !== 0 && (
            <span className={`text-xs font-semibold flex items-center gap-0.5 ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {delta > 0 ? <FaArrowUp className="text-[9px]" /> : <FaArrowDown className="text-[9px]" />}
              {Math.abs(delta)}%
            </span>
          )}
          {delta === 0 && <FaMinus className="text-gray-400 text-xs" />}
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// CHART WRAPPER
// ════════════════════════════════════════════

function ChartCard({ title, children, height = 280 }: { title: string; children: React.ReactNode; height?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm" style={{ minHeight: height }}>
      <h3 className="text-sm font-bold text-[#010139] mb-3">{title}</h3>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════
// HEATMAP
// ════════════════════════════════════════════

function Heatmap({ data }: { data: { hour: number; dayOfWeek: number; count: number }[] }) {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr>
            <th className="w-8"></th>
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} className="text-gray-400 font-normal px-0.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day, di) => (
            <tr key={di}>
              <td className="text-gray-500 font-medium pr-1">{day}</td>
              {Array.from({ length: 24 }, (_, h) => {
                const entry = data.find(d => d.hour === h && d.dayOfWeek === di);
                const count = entry?.count || 0;
                const intensity = count / maxCount;
                const bg = count === 0
                  ? 'bg-gray-100'
                  : intensity < 0.3
                    ? 'bg-blue-200'
                    : intensity < 0.6
                      ? 'bg-blue-400'
                      : 'bg-blue-600';
                return (
                  <td key={h} className="px-0.5 py-0.5">
                    <div
                      className={`w-full h-4 rounded-sm ${bg} transition-colors`}
                      title={`${day} ${h}:00 — ${count} cotizaciones`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ════════════════════════════════════════════
// EXPORT HELPERS
// ════════════════════════════════════════════

async function exportToPdf(data: DashboardData) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const ov = data.overview;

  doc.setFontSize(18);
  doc.text('ADM COT — Dashboard', 14, 20);
  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleString('es-PA')}`, 14, 28);

  doc.setFontSize(12);
  doc.text('KPIs Generales', 14, 40);
  doc.setFontSize(9);
  const kpiLines = [
    `Cotizaciones Hoy: ${ov.quotesToday} | Semana: ${ov.quotesWeek} | Mes: ${ov.quotesMonth} | Total: ${ov.quotesTotal}`,
    `Emisiones Hoy: ${ov.emissionsToday} | Semana: ${ov.emissionsWeek} | Mes: ${ov.emissionsMonth} | Total: ${ov.emissionsTotal}`,
    `Conversión: ${ov.conversionRateGlobal}% | Tiempo Prom.: ${ov.avgTimeToEmitMinutes} min`,
    `Fallidas: ${ov.failedTotal} | Abandonadas: ${ov.abandonedTotal}`,
    `Pagos Pendientes: $${ov.pendingPaymentsTotal.toFixed(2)} (${ov.pendingPaymentsCount}) | Devoluciones: $${ov.refundsTotal.toFixed(2)} (${ov.refundsCount})`,
  ];
  kpiLines.forEach((line, i) => doc.text(line, 14, 48 + i * 6));

  doc.setFontSize(12);
  doc.text('Por Aseguradora', 14, 84);
  doc.setFontSize(9);
  data.byInsurer.forEach((ins, i) => {
    doc.text(`${ins.insurer}: ${ins.quotes} cotizaciones, ${ins.emissions} emisiones (${ins.conversionRate}%), Revenue: $${ins.revenue.toFixed(2)}`, 14, 92 + i * 6);
  });

  if (data.errors.length > 0) {
    doc.setFontSize(12);
    doc.text('Errores Recientes', 14, 120);
    doc.setFontSize(8);
    data.errors.slice(0, 10).forEach((err, i) => {
      doc.text(`[${err.insurer}] ${err.errorMessage} (×${err.count})`, 14, 128 + i * 5);
    });
  }

  doc.save('adm-cot-dashboard.pdf');
}

async function exportToExcel(data: DashboardData) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // Overview sheet
  const ovRows = Object.entries(data.overview).map(([k, v]) => ({ Metric: k, Value: v }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ovRows), 'Overview');

  // Time series
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.timeSeries), 'TimeSeries');

  // By Insurer
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.byInsurer), 'ByInsurer');

  // Funnel
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.funnel), 'Funnel');

  // Errors
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.errors), 'Errors');

  // Region / Device
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.byRegion), 'ByRegion');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.byDevice), 'ByDevice');

  XLSX.writeFile(wb, 'adm-cot-dashboard.xlsx');
}

// ════════════════════════════════════════════
// DASHBOARD MAIN
// ════════════════════════════════════════════

export default function AdmCotDashboard() {
  const { preset, dateFrom, dateTo, applyPreset, setDateFrom, setDateTo } = useDateRange();
  const [selectedInsurer, setSelectedInsurer] = useState('');
  const [selectedRamo, setSelectedRamo] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const fetchDashboard = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (selectedInsurer) params.set('insurer', selectedInsurer);
      if (selectedRamo) params.set('ramo', selectedRamo);
      if (selectedRegion) params.set('region', selectedRegion);
      if (selectedDevice) params.set('device', selectedDevice);

      const res = await fetch(`/api/adm-cot/dashboard?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDashData(json.data);
      } else {
        setError(json.error || 'Error cargando métricas');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [dateFrom, dateTo, selectedInsurer, selectedRamo, selectedRegion, selectedDevice]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const ov = dashData?.overview;
  const fmt$ = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* ── Filters Bar ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <FaFilter className="text-gray-400" />

          <div className="flex gap-1">
            {(['today', 'week', 'month', '3months', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                  preset === p ? 'bg-[#010139] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : p === '3months' ? '3 Meses' : 'Año'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); applyPreset('custom'); }}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5" />
            <span className="text-gray-400 text-xs">—</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); applyPreset('custom'); }}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5" />
          </div>

          <select value={selectedInsurer} onChange={(e) => setSelectedInsurer(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
            <option value="">Todas las aseguradoras</option>
            <option value="INTERNACIONAL">Internacional</option>
            <option value="FEDPA">FEDPA</option>
          </select>

          <select value={selectedRamo} onChange={(e) => setSelectedRamo(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
            <option value="">Todos los ramos</option>
            <option value="AUTO">Auto</option>
            <option value="SALUD">Salud</option>
            <option value="VIDA">Vida</option>
          </select>

          <div className="ml-auto flex gap-2">
            {dashData && (
              <>
                <button onClick={() => exportToPdf(dashData)} className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <FaFilePdf /> PDF
                </button>
                <button onClick={() => exportToExcel(dashData)} className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <FaFileExcel /> Excel
                </button>
              </>
            )}
            <button onClick={fetchDashboard} disabled={isLoading}
              className="px-3 py-1.5 bg-[#010139] text-white text-xs font-medium rounded-lg hover:bg-[#020270] transition-colors flex items-center gap-1.5 cursor-pointer">
              <FaSync className={isLoading ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <FaExclamationTriangle className="inline mr-2" /> {error}
        </div>
      )}

      {/* ── KPIs Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiCard label="Cotizaciones Hoy" value={ov?.quotesToday ?? '—'} icon={<FaFileAlt />} color="blue" />
        <KpiCard label="Cotizaciones Semana" value={ov?.quotesWeek ?? '—'} icon={<FaFileAlt />} color="blue" delta={ov?.quotesWeekDelta} />
        <KpiCard label="Cotizaciones Mes" value={ov?.quotesMonth ?? '—'} icon={<FaFileAlt />} color="indigo" delta={ov?.quotesMonthDelta} />
        <KpiCard label="Conversión" value={ov ? `${ov.conversionRateGlobal}%` : '—'} icon={<FaPercent />} color="green"
          subtitle="Cotización → Emisión" alertKey="conversionRate" alertValue={ov?.conversionRateGlobal} />
        <KpiCard label="Tiempo Prom." value={ov ? `${ov.avgTimeToEmitMinutes} min` : '—'} icon={<FaClock />} color="amber"
          subtitle="Hasta emisión" alertKey="avgTimeToEmit" alertValue={ov?.avgTimeToEmitMinutes} />
        <KpiCard label="Emisiones Total" value={ov?.emissionsTotal ?? '—'} icon={<FaCheckCircle />} color="green" />
        <KpiCard label="Emisiones Semana" value={ov?.emissionsWeek ?? '—'} icon={<FaCheckCircle />} color="green" delta={ov?.emissionsWeekDelta} />
        <KpiCard label="Fallidas" value={ov?.failedTotal ?? '—'} icon={<FaBug />} color="red" />
        <KpiCard label="Abandonadas" value={ov?.abandonedTotal ?? '—'} icon={<FaExclamationTriangle />} color="amber" />
        <KpiCard label="Pagos Pendientes" value={ov ? fmt$(ov.pendingPaymentsTotal) : '—'} icon={<FaMoneyBillWave />} color="amber"
          subtitle={`${ov?.pendingPaymentsCount ?? 0} pagos`} alertKey="pendingPayments" alertValue={ov?.pendingPaymentsCount} />
        <KpiCard label="Devoluciones" value={ov ? fmt$(ov.refundsTotal) : '—'} icon={<FaUndoAlt />} color="red"
          subtitle={`${ov?.refundsCount ?? 0} registros`} />
        <KpiCard label="Total Cotizaciones" value={ov?.quotesTotal ?? '—'} icon={<FaBuilding />} color="purple" />
      </div>

      {/* ── Charts Row 1: Time Series + By Insurer ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Cotizaciones y Emisiones — Últimos 30 Días" height={320}>
          {dashData?.timeSeries && dashData.timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dashData.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(d) => `Fecha: ${d}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="quotes" stroke="#010139" strokeWidth={2} name="Cotizaciones" dot={false} />
                <Line type="monotone" dataKey="emissions" stroke="#8AAA19" strokeWidth={2} name="Emisiones" dot={false} />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" name="Fallidas" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">Sin datos</div>
          )}
        </ChartCard>

        <ChartCard title="Emisiones por Aseguradora" height={320}>
          {dashData?.byInsurer && dashData.byInsurer.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dashData.byInsurer}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="insurer" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="quotes" fill="#010139" name="Cotizaciones" radius={[4, 4, 0, 0]} />
                <Bar dataKey="emissions" fill="#8AAA19" name="Emisiones" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">Sin datos</div>
          )}
        </ChartCard>
      </div>

      {/* ── Charts Row 2: Funnel + Heatmap + Devices ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ChartCard title="Funnel de Conversión" height={300}>
          {dashData?.funnel && dashData.funnel.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dashData.funnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="step" tick={{ fontSize: 9 }} width={80} />
                <Tooltip formatter={(v: any) => [v, 'Cotizaciones']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {dashData.funnel.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[240px] text-gray-400 text-sm">Sin datos</div>
          )}
        </ChartCard>

        <ChartCard title="Actividad por Hora" height={300}>
          {dashData?.heatmap ? (
            <Heatmap data={dashData.heatmap} />
          ) : (
            <div className="flex items-center justify-center h-[240px] text-gray-400 text-sm">Sin datos</div>
          )}
        </ChartCard>

        <ChartCard title="Dispositivos" height={300}>
          {dashData?.byDevice && dashData.byDevice.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={dashData.byDevice} dataKey="count" nameKey="device" cx="50%" cy="50%" outerRadius={85}
                  label={(props: any) => `${props.device ?? props.name ?? ''} ${props.pct ?? ''}%`} labelLine={false}>
                  {dashData.byDevice.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[240px] text-gray-400 text-sm">Sin datos</div>
          )}
        </ChartCard>
      </div>

      {/* ── Charts Row 3: Region + Errors ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Distribución por Región" height={280}>
          {dashData?.byRegion && dashData.byRegion.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={dashData.byRegion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="region" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8AAA19" name="Cotizaciones" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[230px] text-gray-400 text-sm">Sin datos</div>
          )}
        </ChartCard>

        <ChartCard title="Errores Recientes" height={280}>
          {dashData?.errors && dashData.errors.length > 0 ? (
            <div className="overflow-y-auto max-h-[230px] space-y-2">
              {dashData.errors.slice(0, 10).map((err, i) => (
                <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-2.5">
                  <FaBug className="text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-700">{err.insurer}</span>
                      <span className="text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full font-medium">×{err.count}</span>
                    </div>
                    <p className="text-xs text-red-600 truncate">{err.errorMessage}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[230px] text-green-500 text-sm">
              <FaCheckCircle className="mr-2" /> Sin errores recientes
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Summary Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-bold text-[#010139]">Tabla Resumen por Aseguradora</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Aseguradora</th>
                <th className="py-2 px-3 text-xs font-semibold text-gray-500 uppercase text-right">Cotizaciones</th>
                <th className="py-2 px-3 text-xs font-semibold text-gray-500 uppercase text-right">Emisiones</th>
                <th className="py-2 px-3 text-xs font-semibold text-gray-500 uppercase text-right">Conversión</th>
                <th className="py-2 px-3 text-xs font-semibold text-gray-500 uppercase text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(dashData?.byInsurer ?? []).map((ins) => (
                <tr key={ins.insurer} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-medium text-[#010139]">{ins.insurer}</td>
                  <td className="py-3 px-3 text-gray-600 text-right">{ins.quotes}</td>
                  <td className="py-3 px-3 text-gray-600 text-right">{ins.emissions}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-semibold ${ins.conversionRate >= 15 ? 'text-green-600' : ins.conversionRate >= 8 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {ins.conversionRate}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-600 text-right">{fmt$(ins.revenue)}</td>
                </tr>
              ))}
              {dashData?.byInsurer && dashData.byInsurer.length > 0 && (
                <tr className="bg-gray-50 font-bold">
                  <td className="py-3 px-3 text-[#010139]">TOTAL</td>
                  <td className="py-3 px-3 text-right">{dashData.byInsurer.reduce((s, i) => s + i.quotes, 0)}</td>
                  <td className="py-3 px-3 text-right">{dashData.byInsurer.reduce((s, i) => s + i.emissions, 0)}</td>
                  <td className="py-3 px-3 text-right">{ov?.conversionRateGlobal ?? 0}%</td>
                  <td className="py-3 px-3 text-right">{fmt$(dashData.byInsurer.reduce((s, i) => s + i.revenue, 0))}</td>
                </tr>
              )}
              {(!dashData?.byInsurer || dashData.byInsurer.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">Sin datos de aseguradoras</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Generated at ── */}
      {dashData?.generatedAt && (
        <p className="text-xs text-gray-400 text-right">
          Última actualización: {new Date(dashData.generatedAt).toLocaleString('es-PA')}
        </p>
      )}
    </div>
  );
}
