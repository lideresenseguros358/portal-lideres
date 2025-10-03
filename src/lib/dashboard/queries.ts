import { startOfYear, endOfYear, startOfMonth, endOfMonth } from "date-fns";

import { getSupabaseServer, type Tables } from "@/lib/supabase/server";
import type {
  AnnualNet,
  CalendarEvent,
  ContestProgress,
  DashboardRole,
  FortnightStatus,
  NetCommissions,
  PendingCases,
  RankingEntry,
  RankingResult,
  YtdComparison,
  MonthlyTotal,
  FortnightRow,
} from "./types";

type ProfileRow = Tables<"profiles">;

interface ProfileInfo {
  role: DashboardRole;
  brokerId: string | null;
  fullName: string | null;
}

const CURRENT_YEAR = new Date().getFullYear();

const FETCH_LIMIT = 2000;

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
};

async function getProfile(userId: string): Promise<ProfileInfo | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("role, broker_id, full_name")
    .eq("id", userId)
    .single<Pick<ProfileRow, "role" | "broker_id" | "full_name">>();

  if (error || !data) return null;

  return {
    role: (data.role ?? "broker") as DashboardRole,
    brokerId: data.broker_id,
    fullName: data.full_name,
  };
}

async function resolveBrokerId(userId: string): Promise<string | null> {
  const profile = await getProfile(userId);
  return profile?.brokerId ?? null;
}

async function fetchFortnight(statusList: FortnightRow["status"][]): Promise<FortnightRow | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("fortnights")
    .select("*")
    .in("status", statusList)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle<FortnightRow>();

  if (error || !data) return null;
  return data;
}

async function sumFortnightTotals(
  fortnightId: string,
  brokerId?: string | null,
): Promise<number> {
  const supabase = await getSupabaseServer();
  let query = supabase
    .from("fortnight_broker_totals")
    .select("net_amount", { count: "exact" })
    .eq("fortnight_id", fortnightId)
    .limit(FETCH_LIMIT);

  if (brokerId) {
    query = query.eq("broker_id", brokerId);
  }

  const { data, error } = await query.returns<{ net_amount: number | string | null }[]>();
  if (error || !data) return 0;
  return data.reduce((acc: number, item) => acc + toNumber(item.net_amount), 0);
}

export async function getFortnightStatus(userId: string, role: DashboardRole): Promise<FortnightStatus> {
  const brokerId = role === "broker" ? await resolveBrokerId(userId) : null;

  const paidFortnight = await fetchFortnight(["PAID"]);
  const openFortnight = await fetchFortnight(["READY", "DRAFT"]);

  const result: FortnightStatus = {};

  if (paidFortnight) {
    const total = await sumFortnightTotals(paidFortnight.id, brokerId ?? undefined);
    result.paid = {
      fortnight: paidFortnight,
      total,
    };
  }

  if (openFortnight) {
    const total = await sumFortnightTotals(openFortnight.id, brokerId ?? undefined);
    result.open = {
      fortnight: openFortnight,
      total,
    };
  }

  return result;
}

export async function getNetCommissions(userId: string, role: DashboardRole): Promise<NetCommissions> {
  const status = await getFortnightStatus(userId, role);
  return {
    lastPaid: status.paid?.total ?? 0,
    open: status.open?.total ?? 0,
  };
}

export async function getAnnualNet(userId: string, role: DashboardRole): Promise<AnnualNet> {
  const supabase = await getSupabaseServer();
  const brokerId = role === "broker" ? await resolveBrokerId(userId) : null;

  let query = supabase
    .from("production")
    .select("pma_neto")
    .eq("year", CURRENT_YEAR)
    .limit(FETCH_LIMIT);

  if (brokerId) {
    query = query.eq("broker_id", brokerId);
  }

  const { data, error } = await query.returns<{ pma_neto: number | string | null }[]>();
  if (error || !data) {
    return { value: 0 };
  }

  const value = data.reduce((acc: number, item) => acc + toNumber(item.pma_neto), 0);
  return { value };
}

// Get production data for Master dashboard
export async function getProductionData() {
  const supabase = await getSupabaseServer();
  const currentYear = CURRENT_YEAR;
  
  // Get total PMA for current year
  const { data: currentYearData } = await supabase
    .from("production")
    .select("pma_neto")
    .eq("year", currentYear)
    .returns<{ pma_neto: number | string | null }[]>();
    
  const totalPMA = (currentYearData ?? []).reduce((acc, item) => acc + toNumber(item.pma_neto), 0);
  
  // Get previous year total for comparison
  const { data: previousYearData } = await supabase
    .from("production")
    .select("pma_neto")
    .eq("year", currentYear - 1)
    .returns<{ pma_neto: number | string | null }[]>();
    
  const previousTotal = (previousYearData ?? []).reduce((acc, item) => acc + toNumber(item.pma_neto), 0);
  
  const deltaPercent = previousTotal > 0 ? ((totalPMA - previousTotal) / previousTotal) * 100 : 0;
  
  return {
    totalPMA,
    previousTotal,
    deltaPercent,
    year: currentYear
  };
}

// Get broker ranking for Master dashboard
export async function getBrokerRanking() {
  const supabase = await getSupabaseServer();
  
  const { data } = await supabase
    .from("production")
    .select("broker_id, pma_neto")
    .eq("year", CURRENT_YEAR)
    .returns<{ broker_id: string | null; pma_neto: number | string | null }[]>();
  
  const totalsMap = new Map<string, number>();
  (data ?? []).forEach((item) => {
    if (!item.broker_id) return;
    totalsMap.set(item.broker_id, (totalsMap.get(item.broker_id) ?? 0) + toNumber(item.pma_neto));
  });
  
  const rows = Array.from(totalsMap.entries()).map(([id, total]) => ({ broker_id: id, total }));
  const brokerIds = rows.map((item) => item.broker_id);
  
  const { data: brokerInfo } = await supabase
    .from("brokers")
    .select("id, name")
    .in("id", brokerIds.length > 0 ? brokerIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<{ id: string | null; name: string | null }[]>();
  
  const nameMap = new Map<string, string>();
  (brokerInfo ?? []).forEach((item) => {
    if (item.id) nameMap.set(item.id, item.name ?? "");
  });
  
  return rows
    .map((item) => ({
      brokerId: item.broker_id,
      brokerName: nameMap.get(item.broker_id) ?? "",
      total: toNumber(item.total),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

// Get operations data (cases, renewals, delinquency)
export async function getOperationsData() {
  const supabase = await getSupabaseServer();
  const today = new Date();
  const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sixtyDays = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const ninetyDays = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  
  // Get cases by status
  const { data: casesData } = await supabase
    .from("cases")
    .select("status")
    .returns<{ status: string | null }[]>();
    
  const casesByStatus = {
    enTramite: 0,
    pendienteInfo: 0,
    aplazado: 0,
    emitido: 0,
    cerrado: 0
  };
  
  (casesData ?? []).forEach((item) => {
    switch(item.status) {
      case 'IN_PROGRESS': casesByStatus.enTramite++; break;
      case 'PENDING_INFO': casesByStatus.pendienteInfo++; break;
      case 'POSTPONED': casesByStatus.aplazado++; break;
      case 'ISSUED': casesByStatus.emitido++; break;
      case 'CLOSED': casesByStatus.cerrado++; break;
    }
  });
  
  // Get renewals
  const { data: renewals30 } = await supabase
    .from("policies")
    .select("id", { count: "exact" })
    .gte("renewal_date", today.toISOString())
    .lte("renewal_date", thirtyDays.toISOString());
    
  const { data: renewals60 } = await supabase
    .from("policies")
    .select("id", { count: "exact" })
    .gte("renewal_date", thirtyDays.toISOString())
    .lte("renewal_date", sixtyDays.toISOString());
    
  const { data: renewals90 } = await supabase
    .from("policies")
    .select("id", { count: "exact" })
    .gte("renewal_date", sixtyDays.toISOString())
    .lte("renewal_date", ninetyDays.toISOString());
    
  // Get delinquency data - simplified for now since table doesn't exist yet
  const totalVencido = 0; // TODO: Implement when delinquency table is available
  
  return {
    cases: casesByStatus,
    renewals: {
      days30: renewals30?.length ?? 0,
      days60: renewals60?.length ?? 0,
      days90: renewals90?.length ?? 0
    },
    delinquency: {
      totalVencido
    }
  };
}

// Get finance data (commissions and checks)
export async function getFinanceData() {
  const supabase = await getSupabaseServer();
  const currentYear = CURRENT_YEAR;
  
  // Get last paid fortnight
  const { data: lastPaidFortnight } = await supabase
    .from("fortnights")
    .select("id, period_start, period_end")
    .eq("status", "PAID")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
    
  let lastPaidAmount = 0;
  if (lastPaidFortnight) {
    const { data: totals } = await supabase
      .from("fortnight_broker_totals")
      .select("net_amount")
      .eq("fortnight_id", lastPaidFortnight.id)
      .returns<{ net_amount: number | string | null }[]>();
      
    lastPaidAmount = (totals ?? []).reduce((acc, item) => acc + toNumber(item.net_amount), 0);
  }
  
  // Get annual accumulated
  const { data: annualFortnights } = await supabase
    .from("fortnights")
    .select("id")
    .eq("status", "PAID")
    .gte("period_start", `${currentYear}-01-01`)
    .lte("period_end", `${currentYear}-12-31`)
    .returns<{ id: string }[]>();
    
  let annualAccumulated = 0;
  if (annualFortnights && annualFortnights.length > 0) {
    const fortnightIds = annualFortnights.map(f => f.id);
    const { data: annualTotals } = await supabase
      .from("fortnight_broker_totals")
      .select("net_amount")
      .in("fortnight_id", fortnightIds)
      .returns<{ net_amount: number | string | null }[]>();
      
    annualAccumulated = (annualTotals ?? []).reduce((acc, item) => acc + toNumber(item.net_amount), 0);
  }
  
  // Get checks data (simplified for now)
  const checksData = {
    received: 0,
    applied: 0,
    pending: 0,
    returned: 0
  };
  
  return {
    lastPaidAmount,
    annualAccumulated,
    checks: checksData
  };
}

export async function getPendingCases(): Promise<PendingCases> {
  try {
    const supabase = await getSupabaseServer();

    const [checklistRes, casesRes] = await Promise.all([
      supabase
        .from("case_checklist")
        .select("id", { count: "exact", head: true })
        .eq("label", "FALTA_DOC")
        .eq("completed", false),
      supabase
        .from("cases")
        .select("id", { count: "exact", head: true })
        .eq("section", "SIN_CLASIFICAR"),
    ]);

    const faltaDoc = checklistRes.count ?? 0;
    const sinClasificar = casesRes.count ?? 0;

    return { faltaDoc, sinClasificar };
  } catch (error) {
    // TODO: Revisar si existe el esquema de casos en el entorno actual.
    return { faltaDoc: 0, sinClasificar: 0 };
  }
}

const aggregateMonthlyTotals = (
  rows?: { month: number | null; total?: number | string | null; pma_neto?: number | string | null }[] | null,
): MonthlyTotal[] => {
  if (!rows) return [];
  const totals = new Map<number, number>();
  rows.forEach((row) => {
    const month = row.month ?? 0;
    if (!month) return;
    const value = toNumber(row.total ?? row.pma_neto);
    totals.set(month, (totals.get(month) ?? 0) + value);
  });

  return Array.from(totals.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month - b.month);
};

export async function getYtdComparison(userId: string, role: DashboardRole): Promise<YtdComparison> {
  const supabase = await getSupabaseServer();
  const brokerId = role === "broker" ? await resolveBrokerId(userId) : null;

  const currentYear = CURRENT_YEAR;
  const previousYear = CURRENT_YEAR - 1;

  const buildQuery = (year: number) => {
    let query = supabase
      .from("production")
      .select("month, total:pma_neto")
      .eq("year", year)
      .order("month", { ascending: true })
      .limit(FETCH_LIMIT);

    if (brokerId) {
      query = query.eq("broker_id", brokerId);
    }

    return query;
  };

  const [{ data: currentData }, { data: previousData }] = await Promise.all([
    buildQuery(currentYear).returns<{ month: number | null; total: number | string | null }[]>(),
    buildQuery(previousYear).returns<{ month: number | null; total: number | string | null }[]>(),
  ]);

  return {
    current: aggregateMonthlyTotals(currentData),
    previous: aggregateMonthlyTotals(previousData),
  };
}

export async function getRankingTop5(userId: string): Promise<RankingResult> {
  const supabase = await getSupabaseServer();
  const profile = await getProfile(userId);
  const brokerId = profile?.brokerId ?? null;

  const { data, error } = await supabase
    .from("production")
    .select("broker_id, pma_neto")
    .eq("year", CURRENT_YEAR)
    .limit(FETCH_LIMIT)
    .returns<{ broker_id: string | null; pma_neto: number | string | null }[]>();

  if (error || !data) {
    return { entries: [], currentBrokerId: brokerId ?? undefined };
  }

  const totalsMap = new Map<string, number>();
  data.forEach((item: { broker_id: string | null; pma_neto: number | string | null }) => {
    if (!item.broker_id) return;
    totalsMap.set(item.broker_id, (totalsMap.get(item.broker_id) ?? 0) + toNumber(item.pma_neto));
  });

  const rows = Array.from(totalsMap.entries()).map(([id, total]) => ({ broker_id: id, total }));
  const brokerIds = rows.map((item) => item.broker_id);

  const { data: brokerInfo } = await supabase
    .from("brokers")
    .select("id, name")
    .in("id", brokerIds.length > 0 ? brokerIds : ["00000000-0000-0000-0000-000000000000"])
    .limit(FETCH_LIMIT)
    .returns<{ id: string | null; name: string | null }[]>();

  const nameMap = new Map<string, string>();
  (brokerInfo ?? []).forEach((item: { id: string | null; name: string | null }) => {
    if (item.id) {
      nameMap.set(item.id, item.name ?? "");
    }
  });

  const ranking = rows
    .map((item) => ({
      brokerId: item.broker_id,
      brokerName: nameMap.get(item.broker_id) ?? "",
      total: toNumber(item.total),
    }))
    .sort((a, b) => b.total - a.total);

  const entries: RankingEntry[] = ranking.slice(0, 5).map((item, index) => ({
    brokerId: item.brokerId,
    brokerName: item.brokerName,
    position: index + 1,
    total: brokerId && item.brokerId === brokerId ? item.total : undefined,
  }));

  let currentPosition: number | undefined;
  let currentTotal: number | undefined;

  if (brokerId) {
    const idx = ranking.findIndex((item) => item.brokerId === brokerId);
    if (idx >= 0 && ranking[idx]) {
      currentPosition = idx + 1;
      currentTotal = ranking[idx].total;

      if (idx >= 5) {
        entries.push({
          brokerId,
          brokerName: ranking[idx].brokerName,
          position: currentPosition,
          total: currentTotal,
        });
      }
    }
  }

  return {
    entries,
    currentBrokerId: brokerId ?? undefined,
    currentPosition,
    currentTotal,
  };
}

const SETTINGS_KEYS = {
  convivio: "convivio_target_ytd",
  assa: "assa_target_ytd",
} as const;

async function fetchContestTarget(key: string): Promise<number> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle<{ value: unknown }>();

  if (!data || !data.value) return 0;

  if (typeof data.value === "number") return data.value;
  if (typeof data.value === "string") {
    const parsed = Number(data.value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof data.value === "object" && data.value !== null && "target" in data.value) {
    const parsed = Number((data.value as Record<string, unknown>).target);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function computePercent(value: number, target: number): { percent: number; tooltip?: string } {
  if (target <= 0) {
    return { percent: 0, tooltip: "TODO: Definir meta en app_settings" };
  }
  const pct = (value / target) * 100;
  if (pct >= 100) {
    return { percent: pct, tooltip: "Felicidades lo lograste" };
  }
  return { percent: pct };
}

export async function getContestProgress(userId: string): Promise<ContestProgress[]> {
  const supabase = await getSupabaseServer();
  const profile = await getProfile(userId);
  const brokerId = profile?.brokerId ?? null;
  const role = profile?.role ?? "broker";

  const now = new Date();
  const year = now.getFullYear();

  const convivioMonths = Array.from({ length: 8 }, (_, idx) => idx + 1);
  const assaMonths = Array.from({ length: 12 }, (_, idx) => idx + 1);

  const buildQuery = (months: number[]) => {
    let query = supabase
      .from("production")
      .select("pma_neto, month")
      .eq("year", year)
      .in("month", months)
      .limit(FETCH_LIMIT);

    if (role === "broker" && brokerId) {
      query = query.eq("broker_id", brokerId);
    }

    return query;
  };

  const [{ data: convivioData }, { data: assaData }] = await Promise.all([
    buildQuery(convivioMonths).returns<{ pma_neto: number | string | null; month: number | null }[]>(),
    buildQuery(assaMonths).returns<{ pma_neto: number | string | null; month: number | null }[]>(),
  ]);

  const convivioValue = (convivioData ?? []).reduce((acc: number, item) => acc + toNumber(item.pma_neto), 0);
  const assaValue = (assaData ?? []).reduce((acc: number, item) => acc + toNumber(item.pma_neto), 0);

  const [convivioTarget, assaTarget] = await Promise.all([
    fetchContestTarget(SETTINGS_KEYS.convivio),
    fetchContestTarget(SETTINGS_KEYS.assa),
  ]);

  const convivioPercent = computePercent(convivioValue, convivioTarget);
  const assaPercent = computePercent(assaValue, assaTarget);

  return [
    {
      label: "Convivio LISSA",
      value: convivioValue,
      target: convivioTarget,
      percent: convivioPercent.percent,
      tooltip: convivioPercent.tooltip,
    },
    {
      label: "Concurso ASSA",
      value: assaValue,
      target: assaTarget,
      percent: assaPercent.percent,
      tooltip: assaPercent.tooltip,
    },
  ];
}

function uniqueEvents(events: CalendarEvent[]): CalendarEvent[] {
  const map = new Map<string, CalendarEvent>();
  events.forEach((event) => {
    map.set(event.date, event);
  });
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getMiniCalendar(userId: string): Promise<CalendarEvent[]> {
  const supabase = await getSupabaseServer();
  const profile = await getProfile(userId);
  const brokerId = profile?.brokerId ?? null;

  if (!profile) return [];

  const start = startOfMonth(new Date()).toISOString();
  const end = endOfMonth(new Date()).toISOString();

  const [{ data: createdEvents, error: createdError }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, start_at")
      .eq("created_by", userId)
      .gte("start_at", start)
      .lte("start_at", end)
      .limit(FETCH_LIMIT)
      .returns<{ id: string; title: string | null; start_at: string }[]>(),
  ]);

  if (createdError) {
    throw new Error(`Error obteniendo eventos creados: ${createdError.message}`);
  }

  const events: CalendarEvent[] = (createdEvents ?? []).map((event: { id: string; title: string | null; start_at: string }) => ({
    date: event.start_at,
    title: event.title ?? "",
  }));

  if (brokerId) {
    const { data: attendeeRows, error: attendeeError } = await supabase
      .from("event_attendees")
      .select("event_id")
      .eq("broker_id", brokerId)
      .limit(FETCH_LIMIT)
      .returns<{ event_id: string }[]>();

    if (attendeeError) {
      throw new Error(`Error obteniendo eventos como asistente: ${attendeeError.message}`);
    }

    const attendeeIds = (attendeeRows ?? []).map((item: { event_id: string }) => item.event_id);

    if (attendeeIds.length > 0) {
      const { data: extraEvents, error: extraError } = await supabase
        .from("events")
        .select("id, title, start_at")
        .in("id", attendeeIds)
        .gte("start_at", start)
        .lte("start_at", end)
        .limit(FETCH_LIMIT)
        .returns<{ id: string; title: string | null; start_at: string }[]>();

      if (extraError) {
        throw new Error(`Error obteniendo eventos adicionales: ${extraError.message}`);
      }

      events.push(
        ...(extraEvents ?? []).map((event: { id: string; title: string | null; start_at: string }) => ({
          date: event.start_at,
          title: event.title ?? "",
        })),
      );
    }
  }

  return uniqueEvents(events);
}
