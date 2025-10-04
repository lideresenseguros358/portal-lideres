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

// Mock data para visualización cuando no hay data real
const MOCK_DATA_ENABLED = true;

function generateMockRanking(): RankingEntry[] {
  const names = ['Juan Pérez', 'María González', 'Carlos Rodríguez', 'Ana Martínez', 'Luis Sánchez'];
  return names.map((name, i) => ({
    position: i + 1,
    brokerId: `mock-${i}`,
    brokerName: name,
    total: (50000 - i * 8000) + Math.random() * 2000,
  }));
}

function generateMockContests(): ContestProgress[] {
  return [
    {
      label: 'ASSA Meta Q1',
      value: 9750,
      target: 15000,
      percent: 65,
      tooltip: 'Falta $5,250 para tu meta',
    },
    {
      label: 'Convivio Meta Q1',
      value: 5040,
      target: 12000,
      percent: 42,
      tooltip: 'Falta $6,960 para tu meta',
    },
  ];
}

function generateMockCalendarEvents(): CalendarEvent[] {
  const today = new Date();
  return [
    {
      date: new Date(today.getFullYear(), today.getMonth(), 15).toISOString(),
      title: 'Cierre de Quincena',
    },
    {
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3).toISOString(),
      title: 'Reunión Equipo',
    },
  ];
}

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
  // Try real data first
  const status = await getFortnightStatus(userId, role);
  const totalPaid = status.paid?.total ?? 0;
  const totalOpen = status.open?.total ?? 0;

  // Si no hay datos reales, usar mock
  if (MOCK_DATA_ENABLED && totalPaid === 0 && totalOpen === 0) {
    return {
      lastPaid: 4250.50,
      open: 3890.25,
    };
  }

  return {
    lastPaid: totalPaid,
    open: totalOpen,
  };
}

export async function getAnnualNet(userId: string, role: DashboardRole): Promise<AnnualNet> {
  const supabase = await getSupabaseServer();
  const brokerId = role === "broker" ? await resolveBrokerId(userId) : null;

  let query = supabase
    .from("production")
    .select("bruto, canceladas")
    .eq("year", CURRENT_YEAR)
    .limit(FETCH_LIMIT);

  if (brokerId) {
    query = query.eq("broker_id", brokerId);
  }

  const { data, error } = await query.returns<{ bruto: number | string | null; canceladas: number | string | null }[]>();
  if (error || !data) {
    return { value: 0 };
  }

  const value = data.reduce((acc: number, item) => {
    const bruto = toNumber(item.bruto);
    const canceladas = toNumber(item.canceladas);
    return acc + (bruto - canceladas);
  }, 0);
  
  // Si no hay datos reales, usar mock
  if (MOCK_DATA_ENABLED && value === 0) {
    return { value: 52340.75 };
  }
  
  return { value };
}

// Get production data for Master dashboard
export async function getProductionData() {
  const supabase = await getSupabaseServer();
  const currentYear = CURRENT_YEAR;
  
  // Get total PMA for current year
  const { data: currentYearData } = await supabase
    .from("production")
    .select("bruto, canceladas")
    .eq("year", currentYear)
    .returns<{ bruto: number | string | null; canceladas: number | string | null }[]>();
    
  const totalPMA = (currentYearData ?? []).reduce((acc, item) => {
    const bruto = toNumber(item.bruto);
    const canceladas = toNumber(item.canceladas);
    return acc + (bruto - canceladas);
  }, 0);
  
  // Get previous year total for comparison
  const { data: previousYearData } = await supabase
    .from("production")
    .select("bruto, canceladas")
    .eq("year", currentYear - 1)
    .returns<{ bruto: number | string | null; canceladas: number | string | null }[]>();
    
  const previousTotal = (previousYearData ?? []).reduce((acc, item) => {
    const bruto = toNumber(item.bruto);
    const canceladas = toNumber(item.canceladas);
    return acc + (bruto - canceladas);
  }, 0);
  
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
  
  // Obtener datos de production del año actual
  const { data } = await (supabase as any)
    .from("production")
    .select(`
      broker_id,
      bruto,
      canceladas,
      brokers!production_broker_id_fkey (
        id,
        name
      )
    `)
    .eq("year", CURRENT_YEAR);
  
  if (!data || data.length === 0) return [];
  
  // Calcular PMA Neto (YTD) por broker
  const totalsMap = new Map<string, { name: string; total: number }>();
  
  data.forEach((item: any) => {
    const brokerId = item.broker_id;
    const brokerName = item.brokers?.name || 'Sin nombre';
    const bruto = parseFloat(item.bruto) || 0;
    const canceladas = parseFloat(item.canceladas) || 0;
    const neto = bruto - canceladas;
    
    if (!totalsMap.has(brokerId)) {
      totalsMap.set(brokerId, { name: brokerName, total: 0 });
    }
    
    const broker = totalsMap.get(brokerId)!;
    broker.total += neto;
  });
  
  // Convertir a array y ordenar
  const rows = Array.from(totalsMap.entries()).map(([id, data]) => ({
    brokerId: id,
    brokerName: data.name,
    total: data.total,
  }));
  
  // Ordenar: descendente por total, en empate alfabético
  rows.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    return a.brokerName.localeCompare(b.brokerName);
  });
  
  return rows.slice(0, 5);
}

// Get broker of the month (previous closed month)
export async function getBrokerOfTheMonth(): Promise<{ brokerName: string; month: string; monthName: string } | null> {
  const supabase = await getSupabaseServer();
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  
  // Regla "mes cerrado": día 1 verificar si hay datos del mes actual, sino mes anterior
  let targetMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  let targetYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  
  if (currentDay === 1) {
    // Verificar si hay datos del mes actual
    const { data: checkCurrent } = await (supabase as any)
      .from("production")
      .select("id")
      .eq("year", currentYear)
      .eq("month", currentMonth) // month es INTEGER
      .limit(1);
    
    if (checkCurrent && checkCurrent.length > 0) {
      targetMonth = currentMonth;
      targetYear = currentYear;
    }
  }
  
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  const { data } = await (supabase as any)
    .from("production")
    .select(`
      broker_id,
      bruto,
      canceladas,
      brokers!production_broker_id_fkey (
        id,
        name
      )
    `)
    .eq("year", targetYear)
    .eq("month", targetMonth); // month es INTEGER 1-12
  
  if (!data || data.length === 0) return null;
  
  // Calcular PMA Neto del mes por broker
  const brokers = data.map((item: any) => ({
    broker_id: item.broker_id,
    broker_name: item.brokers?.name || 'Sin nombre',
    pma_neto: (parseFloat(item.bruto) || 0) - (parseFloat(item.canceladas) || 0)
  }));
  
  // Ordenar: descendente por PMA Neto, en empate alfabético
  brokers.sort((a: any, b: any) => {
    if (b.pma_neto !== a.pma_neto) {
      return b.pma_neto - a.pma_neto;
    }
    return a.broker_name.localeCompare(b.broker_name);
  });
  
  const winner = brokers[0];
  if (!winner) return null;
  
  return {
    brokerName: winner.broker_name,
    month: targetMonth.toString(),
    monthName: monthNames[targetMonth - 1] ?? "",
  };
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
  rows?: { month: number | null; bruto?: number | string | null; canceladas?: number | string | null }[] | null,
): MonthlyTotal[] => {
  if (!rows) return [];
  const totals = new Map<number, number>();
  rows.forEach((row) => {
    const month = row.month ?? 0;
    if (!month) return;
    const bruto = toNumber(row.bruto);
    const canceladas = toNumber(row.canceladas);
    const neto = bruto - canceladas;
    totals.set(month, (totals.get(month) ?? 0) + neto);
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
      .select("month, bruto, canceladas")
      .eq("year", year)
      .order("month", { ascending: true })
      .limit(FETCH_LIMIT);

    if (brokerId) {
      query = query.eq("broker_id", brokerId);
    }

    return query;
  };

  const [{ data: currentData }, { data: previousData }] = await Promise.all([
    buildQuery(currentYear).returns<{ month: number | null; bruto: number | string | null; canceladas: number | string | null }[]>(),
    buildQuery(previousYear).returns<{ month: number | null; bruto: number | string | null; canceladas: number | string | null }[]>(),
  ]);

  const currentTotals = aggregateMonthlyTotals(currentData);
  const previousTotals = aggregateMonthlyTotals(previousData);
  
  // Si no hay datos reales, usar mock
  if (MOCK_DATA_ENABLED && currentTotals.length === 0 && previousTotals.length === 0) {
    return {
      current: [
        { month: 1, total: 3200 },
        { month: 2, total: 4100 },
        { month: 3, total: 3800 },
        { month: 4, total: 5200 },
        { month: 5, total: 4900 },
        { month: 6, total: 6100 },
        { month: 7, total: 5500 },
        { month: 8, total: 5800 },
        { month: 9, total: 6300 },
      ],
      previous: [
        { month: 1, total: 2800 },
        { month: 2, total: 3600 },
        { month: 3, total: 3200 },
        { month: 4, total: 4500 },
        { month: 5, total: 4200 },
        { month: 6, total: 5300 },
        { month: 7, total: 4800 },
        { month: 8, total: 5000 },
        { month: 9, total: 5500 },
      ],
    };
  }
  
  return {
    current: currentTotals,
    previous: previousTotals,
  };
}

export async function getRankingTop5(userId: string): Promise<RankingResult> {
  const supabase = await getSupabaseServer();
  const profile = await getProfile(userId);
  const brokerId = profile?.brokerId ?? null;

  const { data, error } = await supabase
    .from("production")
    .select("broker_id, bruto, canceladas")
    .eq("year", CURRENT_YEAR)
    .limit(FETCH_LIMIT)
    .returns<{ broker_id: string | null; bruto: number | string | null; canceladas: number | string | null }[]>();

  if (error || !data || data.length === 0) {
    // Si no hay datos reales, usar mock
    if (MOCK_DATA_ENABLED) {
      return {
        entries: generateMockRanking(),
        currentBrokerId: brokerId ?? undefined,
        currentPosition: 3,
        currentTotal: 34000,
      };
    }
    return { entries: [], currentBrokerId: brokerId ?? undefined };
  }

  const totalsMap = new Map<string, number>();
  data.forEach((item: { broker_id: string | null; bruto: number | string | null; canceladas: number | string | null }) => {
    if (!item.broker_id) return;
    const bruto = toNumber(item.bruto);
    const canceladas = toNumber(item.canceladas);
    const neto = bruto - canceladas;
    totalsMap.set(item.broker_id, (totalsMap.get(item.broker_id) ?? 0) + neto);
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

  // Mostrar top 5 completo para todos (sin ocultar totales)
  const entries: RankingEntry[] = ranking.slice(0, 5).map((item, index) => ({
    brokerId: item.brokerId,
    brokerName: item.brokerName,
    position: index + 1,
    total: item.total, // Siempre mostrar total
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
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Obtener configuración de contests
  const { data: assaConfigData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'production.contests.assa')
    .single();

  const { data: convivioConfigData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'production.contests.convivio')
    .single();

  const assaConfig = (typeof assaConfigData?.value === 'object' && assaConfigData?.value !== null)
    ? assaConfigData.value as any
    : { start_month: 1, end_month: 12, goal: 250000, goal_double: 400000, enable_double_goal: false, year: currentYear };

  const convivioConfig = (typeof convivioConfigData?.value === 'object' && convivioConfigData?.value !== null)
    ? convivioConfigData.value as any
    : { start_month: 1, end_month: 6, goal: 150000, goal_double: 250000, year: currentYear };

  // Determinar año de concurso (puede ser diferente al año actual si se reseteó)
  const assaYear = assaConfig.year ?? currentYear;
  const convivioYear = convivioConfig.year ?? currentYear;

  // Generar arrays de meses para cada concurso
  const convivioMonths = Array.from(
    { length: convivioConfig.end_month - convivioConfig.start_month + 1 },
    (_, idx) => convivioConfig.start_month + idx
  );
  const assaMonths = Array.from(
    { length: assaConfig.end_month - assaConfig.start_month + 1 },
    (_, idx) => assaConfig.start_month + idx
  );

  const buildQuery = (months: number[], year: number) => {
    let query = supabase
      .from("production")
      .select("bruto, canceladas, month")
      .eq("year", year)
      .in("month", months)
      .limit(FETCH_LIMIT);

    if (role === "broker" && brokerId) {
      query = query.eq("broker_id", brokerId);
    }

    return query;
  };

  const [{ data: convivioData }, { data: assaData }] = await Promise.all([
    buildQuery(convivioMonths, convivioYear).returns<{ bruto: number | string | null; canceladas: number | string | null; month: number | null }[]>(),
    buildQuery(assaMonths, assaYear).returns<{ bruto: number | string | null; canceladas: number | string | null; month: number | null }[]>(),
  ]);

  let convivioValue = (convivioData ?? []).reduce((acc: number, item) => {
    const bruto = toNumber(item.bruto);
    const canceladas = toNumber(item.canceladas);
    return acc + (bruto - canceladas);
  }, 0);
  let assaValue = (assaData ?? []).reduce((acc: number, item) => {
    const bruto = toNumber(item.bruto);
    const canceladas = toNumber(item.canceladas);
    return acc + (bruto - canceladas);
  }, 0);

  // Determinar estado de ASSA
  let assaStatus: 'active' | 'closed' | 'won' | 'lost' = 'active';
  let assaQuotaType: 'single' | 'double' | undefined = undefined;

  // Verificar si estamos en el rango de fechas del concurso
  const isAssaActive = currentYear === assaYear && currentMonth >= assaConfig.start_month && currentMonth <= assaConfig.end_month;
  const assaPassed = currentYear > assaYear || (currentYear === assaYear && currentMonth > assaConfig.end_month);
  const assaFuture = currentYear < assaYear || (currentYear === assaYear && currentMonth < assaConfig.start_month);

  if (assaPassed) {
    // Concurso terminó: verificar si cumplió meta
    if (assaConfig.enable_double_goal && assaConfig.goal_double && assaValue >= assaConfig.goal_double) {
      assaStatus = 'won';
      assaQuotaType = 'double';
    } else if (assaValue >= assaConfig.goal) {
      assaStatus = 'won';
      assaQuotaType = 'single';
    } else {
      assaStatus = 'lost';
    }
  } else if (assaFuture) {
    // Concurso aún no inicia
    assaStatus = 'closed';
  } else if (isAssaActive) {
    // Concurso está activo
    assaStatus = 'active';
  }

  // Determinar estado de Convivio
  let convivioStatus: 'active' | 'closed' | 'won' | 'lost' = 'active';
  let convivioQuotaType: 'single' | 'double' | undefined = undefined;

  const isConvivioActive = currentYear === convivioYear && currentMonth >= convivioConfig.start_month && currentMonth <= convivioConfig.end_month;
  const convivioPassed = currentYear > convivioYear || (currentYear === convivioYear && currentMonth > convivioConfig.end_month);
  const convivioFuture = currentYear < convivioYear || (currentYear === convivioYear && currentMonth < convivioConfig.start_month);

  if (convivioPassed) {
    // Concurso terminó: verificar si cumplió meta
    if (convivioConfig.goal_double && convivioValue >= convivioConfig.goal_double) {
      convivioStatus = 'won';
      convivioQuotaType = 'double';
    } else if (convivioValue >= convivioConfig.goal) {
      convivioStatus = 'won';
      convivioQuotaType = 'single';
    } else {
      convivioStatus = 'lost';
    }
  } else if (convivioFuture) {
    // Concurso aún no inicia
    convivioStatus = 'closed';
  } else if (isConvivioActive) {
    // Concurso está activo
    convivioStatus = 'active';
  }

  const convivioPercent = computePercent(convivioValue, convivioConfig.goal);
  const assaPercent = computePercent(assaValue, assaConfig.goal);

  return [
    {
      label: "Concurso ASSA",
      value: assaValue,
      target: assaConfig.goal,
      percent: assaPercent.percent,
      tooltip: assaPercent.tooltip,
      contestStatus: assaStatus,
      quotaType: assaQuotaType,
      targetDouble: assaConfig.goal_double,
      enableDoubleGoal: assaConfig.enable_double_goal,
    },
    {
      label: "Convivio LISSA",
      value: convivioValue,
      target: convivioConfig.goal,
      percent: convivioPercent.percent,
      tooltip: convivioPercent.tooltip,
      contestStatus: convivioStatus,
      quotaType: convivioQuotaType,
      targetDouble: convivioConfig.goal_double,
      enableDoubleGoal: true, // Convivio siempre tiene doble
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

  if (!profile) {
    if (MOCK_DATA_ENABLED) {
      return generateMockCalendarEvents();
    }
    return [];
  }

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

  const uniqueEvts = uniqueEvents(events);
  
  // Si no hay eventos reales, usar mock
  if (MOCK_DATA_ENABLED && uniqueEvts.length === 0) {
    return generateMockCalendarEvents();
  }
  
  return uniqueEvts;
}
