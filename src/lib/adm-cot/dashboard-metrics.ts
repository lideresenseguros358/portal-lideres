/**
 * ADM COT — Dashboard Metrics (server-side aggregations)
 * 
 * All computations run server-side via Supabase queries.
 * Results are cached with TTL per filter combination.
 */
'use server';

import { createClient } from '@supabase/supabase-js';
import { getCached, setCache, buildCacheKey } from './dashboard-cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createClient(supabaseUrl, serviceKey);
}

// ════════════════════════════════════════════
// FILTER TYPES
// ════════════════════════════════════════════

export interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  insurer?: string;
  ramo?: string;
  region?: string;
  device?: string;
}

// ════════════════════════════════════════════
// RESULT TYPES
// ════════════════════════════════════════════

export interface DashboardOverview {
  quotesToday: number;
  quotesWeek: number;
  quotesMonth: number;
  quotesTotal: number;
  emissionsToday: number;
  emissionsWeek: number;
  emissionsMonth: number;
  emissionsTotal: number;
  failedTotal: number;
  abandonedTotal: number;
  conversionRateGlobal: number;
  avgTimeToEmitMinutes: number;
  pendingPaymentsTotal: number;
  pendingPaymentsCount: number;
  refundsTotal: number;
  refundsCount: number;
  // Variations (% change vs previous period)
  quotesWeekDelta: number;
  quotesMonthDelta: number;
  emissionsWeekDelta: number;
  emissionsMonthDelta: number;
}

export interface FunnelStep {
  step: string;
  count: number;
  pct: number;
}

export interface TimeSeriesPoint {
  date: string;
  quotes: number;
  emissions: number;
  failed: number;
}

export interface InsurerBreakdown {
  insurer: string;
  quotes: number;
  emissions: number;
  conversionRate: number;
  revenue: number;
}

export interface RegionBreakdown {
  region: string;
  count: number;
  pct: number;
}

export interface DeviceBreakdown {
  device: string;
  count: number;
  pct: number;
}

export interface ErrorBreakdown {
  insurer: string;
  errorMessage: string;
  count: number;
  lastOccurred: string;
}

export interface HourlyHeatmapEntry {
  hour: number;
  dayOfWeek: number;
  count: number;
}

export interface DashboardData {
  overview: DashboardOverview;
  timeSeries: TimeSeriesPoint[];
  byInsurer: InsurerBreakdown[];
  byRegion: RegionBreakdown[];
  byDevice: DeviceBreakdown[];
  funnel: FunnelStep[];
  errors: ErrorBreakdown[];
  heatmap: HourlyHeatmapEntry[];
  generatedAt: string;
}

// ════════════════════════════════════════════
// MAIN FUNCTION
// ════════════════════════════════════════════

export async function getDashboardMetrics(
  filters: DashboardFilters = {}
): Promise<{ ok: true; data: DashboardData } | { ok: false; error: string }> {
  try {
    const cacheKey = buildCacheKey('dashboard', filters);
    const cached = getCached<DashboardData>(cacheKey);
    if (cached) return { ok: true, data: cached };

    const sb = getServiceClient();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgoStr = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const monthAgoStr = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const prevWeekStart = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
    const prevMonthStart = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);

    // Helper: apply common filters to a query builder
    function applyFilters(q: any, dateCol: string) {
      if (filters.dateFrom) q = q.gte(dateCol, filters.dateFrom);
      if (filters.dateTo) q = q.lte(dateCol, filters.dateTo + 'T23:59:59');
      if (filters.insurer) q = q.eq('insurer', filters.insurer);
      if (filters.ramo) q = q.eq('ramo', filters.ramo);
      if (filters.region) q = q.eq('region', filters.region);
      if (filters.device) q = q.eq('device', filters.device);
      return q;
    }

    // ═══════════════════════════════════════
    // PARALLEL QUERIES
    // ═══════════════════════════════════════

    // 1. OVERVIEW COUNTS
    const countQueries = await Promise.all([
      // Quotes: today / week / month / total
      sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).gte('quoted_at', todayStr),
      sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).gte('quoted_at', weekAgoStr),
      sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).gte('quoted_at', monthAgoStr),
      applyFilters(sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }), 'quoted_at'),
      // Emissions: today / week / month / total
      sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).eq('status', 'EMITIDA').gte('emitted_at', todayStr),
      sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).eq('status', 'EMITIDA').gte('emitted_at', weekAgoStr),
      sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).eq('status', 'EMITIDA').gte('emitted_at', monthAgoStr),
      applyFilters(sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).eq('status', 'EMITIDA'), 'emitted_at'),
      // Failed / abandoned
      applyFilters(sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).eq('status', 'FALLIDA'), 'quoted_at'),
      applyFilters(sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).eq('status', 'ABANDONADA'), 'quoted_at'),
      // Previous period for delta
      sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).gte('quoted_at', prevWeekStart).lt('quoted_at', weekAgoStr),
      sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).gte('quoted_at', prevMonthStart).lt('quoted_at', monthAgoStr),
      sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).eq('status', 'EMITIDA').gte('emitted_at', prevWeekStart).lt('emitted_at', weekAgoStr),
      sb.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).eq('status', 'EMITIDA').gte('emitted_at', prevMonthStart).lt('emitted_at', monthAgoStr),
    ]);

    const [
      qToday, qWeek, qMonth, qTotal,
      eToday, eWeek, eMonth, eTotal,
      failedTotal, abandonedTotal,
      prevQWeek, prevQMonth,
      prevEWeek, prevEMonth,
    ] = countQueries.map(r => r.count ?? 0);

    // 2. AVG TIME TO EMIT (only for emitted quotes)
    const { data: emittedQuotes } = await applyFilters(
      sb.from('adm_cot_quotes')
        .select('quoted_at, emitted_at')
        .eq('status', 'EMITIDA')
        .not('emitted_at', 'is', null),
      'quoted_at'
    ).limit(500);

    let avgTimeMinutes = 0;
    if (emittedQuotes && emittedQuotes.length > 0) {
      const totalMs = emittedQuotes.reduce((sum: number, q: any) => {
        const diff = new Date(q.emitted_at).getTime() - new Date(q.quoted_at).getTime();
        return sum + Math.max(0, diff);
      }, 0);
      avgTimeMinutes = Math.round(totalMs / emittedQuotes.length / 60000 * 10) / 10;
    }

    // 3. PAYMENTS
    const [pendPayRes, refundRes] = await Promise.all([
      sb.from('adm_cot_payments').select('amount').eq('status', 'PENDIENTE'),
      sb.from('adm_cot_payments').select('amount').eq('is_refund', true),
    ]);
    const sumAmounts = (rows: any[] | null) => (rows ?? []).reduce((s: number, r: any) => s + (parseFloat(r.amount) || 0), 0);
    const pendingPaymentsTotal = sumAmounts(pendPayRes.data);
    const pendingPaymentsCount = pendPayRes.data?.length ?? 0;
    const refundsTotal = sumAmounts(refundRes.data);
    const refundsCount = refundRes.data?.length ?? 0;

    // Delta calculations
    const calcDelta = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };

    const overview: DashboardOverview = {
      quotesToday: qToday,
      quotesWeek: qWeek,
      quotesMonth: qMonth,
      quotesTotal: qTotal,
      emissionsToday: eToday,
      emissionsWeek: eWeek,
      emissionsMonth: eMonth,
      emissionsTotal: eTotal,
      failedTotal,
      abandonedTotal,
      conversionRateGlobal: qTotal > 0 ? Math.round((eTotal / qTotal) * 100 * 10) / 10 : 0,
      avgTimeToEmitMinutes: avgTimeMinutes,
      pendingPaymentsTotal,
      pendingPaymentsCount,
      refundsTotal,
      refundsCount,
      quotesWeekDelta: calcDelta(qWeek, prevQWeek),
      quotesMonthDelta: calcDelta(qMonth, prevQMonth),
      emissionsWeekDelta: calcDelta(eWeek, prevEWeek),
      emissionsMonthDelta: calcDelta(eMonth, prevEMonth),
    };

    // 4. TIME SERIES (last 30 days, grouped by date)
    const { data: tsRaw } = await applyFilters(
      sb.from('adm_cot_quotes')
        .select('quoted_at, status')
        .gte('quoted_at', monthAgoStr),
      'quoted_at'
    ).order('quoted_at', { ascending: true });

    const tsMap: Record<string, { quotes: number; emissions: number; failed: number }> = {};
    for (let d = 0; d < 30; d++) {
      const dt = new Date(now.getTime() - d * 86400000).toISOString().slice(0, 10);
      tsMap[dt] = { quotes: 0, emissions: 0, failed: 0 };
    }
    (tsRaw ?? []).forEach((row: any) => {
      const dt = row.quoted_at?.slice(0, 10);
      if (dt && tsMap[dt]) {
        tsMap[dt].quotes++;
        if (row.status === 'EMITIDA') tsMap[dt].emissions++;
        if (row.status === 'FALLIDA') tsMap[dt].failed++;
      }
    });
    const timeSeries: TimeSeriesPoint[] = Object.entries(tsMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // 5. BY INSURER
    const { data: byInsurerRaw } = await applyFilters(
      sb.from('adm_cot_quotes').select('insurer, status, annual_premium'),
      'quoted_at'
    );

    const insurerMap: Record<string, { quotes: number; emissions: number; revenue: number }> = {};
    (byInsurerRaw ?? []).forEach((row: any) => {
      if (!insurerMap[row.insurer]) insurerMap[row.insurer] = { quotes: 0, emissions: 0, revenue: 0 };
      const entry = insurerMap[row.insurer]!;
      entry.quotes++;
      if (row.status === 'EMITIDA') {
        entry.emissions++;
        entry.revenue += parseFloat(row.annual_premium) || 0;
      }
    });
    const byInsurer: InsurerBreakdown[] = Object.entries(insurerMap)
      .map(([insurer, v]) => ({
        insurer,
        ...v,
        conversionRate: v.quotes > 0 ? Math.round((v.emissions / v.quotes) * 100 * 10) / 10 : 0,
      }))
      .sort((a, b) => b.quotes - a.quotes);

    // 6. BY REGION
    const { data: regionRaw } = await applyFilters(
      sb.from('adm_cot_quotes').select('region'),
      'quoted_at'
    );
    const regionMap: Record<string, number> = {};
    (regionRaw ?? []).forEach((row: any) => {
      const r = row.region || 'Desconocida';
      regionMap[r] = (regionMap[r] || 0) + 1;
    });
    const totalRegion = Object.values(regionMap).reduce((s, v) => s + v, 0) || 1;
    const byRegion: RegionBreakdown[] = Object.entries(regionMap)
      .map(([region, count]) => ({ region, count, pct: Math.round((count / totalRegion) * 100 * 10) / 10 }))
      .sort((a, b) => b.count - a.count);

    // 7. BY DEVICE
    const { data: deviceRaw } = await applyFilters(
      sb.from('adm_cot_quotes').select('device'),
      'quoted_at'
    );
    const deviceMap: Record<string, number> = {};
    (deviceRaw ?? []).forEach((row: any) => {
      const d = row.device || 'Desconocido';
      deviceMap[d] = (deviceMap[d] || 0) + 1;
    });
    const totalDevice = Object.values(deviceMap).reduce((s, v) => s + v, 0) || 1;
    const byDevice: DeviceBreakdown[] = Object.entries(deviceMap)
      .map(([device, count]) => ({ device, count, pct: Math.round((count / totalDevice) * 100 * 10) / 10 }))
      .sort((a, b) => b.count - a.count);

    // 8. FUNNEL (by last_step)
    const { data: funnelRaw } = await applyFilters(
      sb.from('adm_cot_quotes').select('last_step'),
      'quoted_at'
    );
    const funnelMap: Record<string, number> = {};
    (funnelRaw ?? []).forEach((row: any) => {
      const s = row.last_step || 'inicio';
      funnelMap[s] = (funnelMap[s] || 0) + 1;
    });
    const totalFunnel = Object.values(funnelMap).reduce((s, v) => s + v, 0) || 1;
    const funnelOrder = ['comparar', 'payment', 'emission-data', 'vehicle', 'inspection', 'payment-info', 'review', 'confirmacion'];
    const funnel: FunnelStep[] = funnelOrder
      .map(step => {
        const count = funnelMap[step] || 0;
        return { step, count, pct: Math.round((count / totalFunnel) * 100 * 10) / 10 };
      })
      .filter(s => s.count > 0 || funnelOrder.indexOf(s.step) < 3);

    // 9. ERRORS (failed quotes)
    const { data: errorsRaw } = await applyFilters(
      sb.from('adm_cot_quotes')
        .select('insurer, quote_payload, quoted_at')
        .eq('status', 'FALLIDA'),
      'quoted_at'
    ).order('quoted_at', { ascending: false }).limit(100);

    const errorMap: Record<string, { insurer: string; errorMessage: string; count: number; lastOccurred: string }> = {};
    (errorsRaw ?? []).forEach((row: any) => {
      const payload = row.quote_payload as any;
      const msg = payload?.error_message || 'Unknown error';
      const key = `${row.insurer}:${msg}`;
      if (!errorMap[key]) {
        errorMap[key] = { insurer: row.insurer, errorMessage: msg, count: 0, lastOccurred: row.quoted_at };
      }
      errorMap[key].count++;
    });
    const errors: ErrorBreakdown[] = Object.values(errorMap).sort((a, b) => b.count - a.count).slice(0, 20);

    // 10. HEATMAP (hour × day of week)
    const { data: heatRaw } = await applyFilters(
      sb.from('adm_cot_quotes').select('quoted_at').gte('quoted_at', monthAgoStr),
      'quoted_at'
    );
    const heatmapMap: Record<string, number> = {};
    (heatRaw ?? []).forEach((row: any) => {
      const dt = new Date(row.quoted_at);
      const hour = dt.getUTCHours();
      const dow = dt.getUTCDay();
      const key = `${hour}:${dow}`;
      heatmapMap[key] = (heatmapMap[key] || 0) + 1;
    });
    const heatmap: HourlyHeatmapEntry[] = [];
    for (let h = 0; h < 24; h++) {
      for (let d = 0; d < 7; d++) {
        heatmap.push({ hour: h, dayOfWeek: d, count: heatmapMap[`${h}:${d}`] || 0 });
      }
    }

    // ═══════════════════════════════════════
    // ASSEMBLE RESULT
    // ═══════════════════════════════════════

    const result: DashboardData = {
      overview,
      timeSeries,
      byInsurer,
      byRegion,
      byDevice,
      funnel,
      errors,
      heatmap,
      generatedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    return { ok: true, data: result };
  } catch (e: any) {
    console.error('[ADM-COT DASHBOARD] Error computing metrics:', e);
    return { ok: false, error: e.message };
  }
}
