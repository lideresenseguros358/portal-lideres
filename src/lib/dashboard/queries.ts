import { startOfYear, endOfYear, startOfMonth, endOfMonth } from "date-fns";

import { getSupabaseServer, type Tables } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Mock data para visualización cuando no hay data real
const MOCK_DATA_ENABLED = false;

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
    .from("fortnight_details")
    .select("commission_calculated", { count: "exact" })
    .eq("fortnight_id", fortnightId)
    .limit(FETCH_LIMIT);

  if (brokerId) {
    query = query.eq("broker_id", brokerId);
  }

  const { data, error } = await query.returns<{ commission_calculated: number | string | null }[]>();
  if (error || !data) return 0;
  return data.reduce((acc: number, item) => acc + toNumber(item.commission_calculated), 0);
}

export async function getFortnightStatus(userId: string, role: DashboardRole): Promise<FortnightStatus> {
  const brokerId = role === "broker" ? await resolveBrokerId(userId) : null;

  // Buscar quincenas cerradas (PAID o READY)
  const paidFortnight = await fetchFortnight(["PAID", "READY"]);
  const openFortnight = await fetchFortnight(["DRAFT"]);

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
  const brokerId = role === "broker" ? await resolveBrokerId(userId) : null;
  const supabase = await getSupabaseAdmin(); // USAR ADMIN para ignorar RLS
  
  console.log('🔍 [getNetCommissions] userId:', userId);
  console.log('🔍 [getNetCommissions] role:', role);
  console.log('🔍 [getNetCommissions] brokerId:', brokerId);
  
  let totalPaid = 0;
  let totalOpen = 0;
  let lastPaidFortnight: { period_start: string; period_end: string } | undefined;

  if (brokerId) {
    // Obtener código ASSA del broker
    const { data: brokerData } = await supabase
      .from('brokers')
      .select('assa_code')
      .eq('id', brokerId)
      .single();
    const assaCode = brokerData?.assa_code || null;
    console.log('🔍 [getNetCommissions] assa_code del broker:', assaCode);
    
    // PRIMERO: Ver qué quincenas hay y sus status reales
    const { data: allFortnights } = await supabase
      .from('fortnights')
      .select('id, status, period_start, period_end')
      .order('period_end', { ascending: false })
      .limit(5);
    
    console.log('🔎 [getNetCommissions] TODAS las quincenas (últimas 5):', allFortnights);
    
    // PASO 1: Buscar últimas quincenas PAID/READY (incluir period_start y period_end)
    const { data: paidFortnights, error: fortnightsError } = await supabase
      .from('fortnights')
      .select('id, period_start, period_end')
      .in('status', ['PAID', 'READY'])
      .order('period_end', { ascending: false })
      .limit(10);

    console.log('📅 [getNetCommissions] paidFortnights (PAID/READY):', paidFortnights);
    console.log('📅 [getNetCommissions] fortnightsError:', fortnightsError);

    // PASO 2: Buscar la quincena donde el broker REALMENTE tiene comisiones
    // Iterar sobre las quincenas hasta encontrar una con comisiones del broker
    if (paidFortnights && paidFortnights.length > 0) {
      for (const fortnight of paidFortnights) {
        let commissionsQuery = supabase
          .from('fortnight_details')
          .select('commission_calculated')
          .eq('fortnight_id', fortnight.id);
        
        // Filtrar por broker_id O por assa_code
        if (assaCode) {
          commissionsQuery = commissionsQuery.or(`broker_id.eq.${brokerId},assa_code.eq.${assaCode}`);
        } else {
          commissionsQuery = commissionsQuery.eq('broker_id', brokerId);
        }
        
        const { data: commissions, error: commissionsError } = await commissionsQuery;

        console.log(`💰 [getNetCommissions] Quincena ${fortnight.period_start} - ${fortnight.period_end}:`, commissions?.length || 0, 'comisiones');

        if (commissions && commissions.length > 0) {
          // Encontramos comisiones! Usar esta quincena
          totalPaid = commissions.reduce((acc: number, item: any) => acc + toNumber(item.commission_calculated), 0);
          console.log('✅ [getNetCommissions] totalPaid calculado:', totalPaid);
          
          // Guardar datos de ESTA quincena (donde tiene comisiones)
          lastPaidFortnight = {
            period_start: fortnight.period_start,
            period_end: fortnight.period_end
          };
          
          // Salir del loop, ya encontramos la quincena correcta
          break;
        }
      }
    }

    // PASO 3: Buscar quincena DRAFT
    const { data: draftFortnight, error: draftFortnightError } = await supabase
      .from('fortnights')
      .select('id')
      .eq('status', 'DRAFT')
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('📝 [getNetCommissions] draftFortnight:', draftFortnight);

    if (draftFortnight) {
      const { data: draftCommissions } = await supabase
        .from('fortnight_details')
        .select('commission_calculated')
        .eq('broker_id', brokerId)
        .eq('fortnight_id', draftFortnight.id);

      if (draftCommissions && draftCommissions.length > 0) {
        totalOpen = draftCommissions.reduce((acc, item) => acc + toNumber(item.commission_calculated), 0);
        console.log('✅ [getNetCommissions] totalOpen calculado:', totalOpen);
      }
    }
  }

  console.log('🎯 [getNetCommissions] RESULTADO FINAL - lastPaid:', totalPaid, 'open:', totalOpen);

  // Si no hay datos reales, usar mock
  if (MOCK_DATA_ENABLED && totalPaid === 0 && totalOpen === 0) {
    console.log('🎭 [getNetCommissions] Usando MOCK DATA');
    return {
      lastPaid: 4250.50,
      open: 3890.25,
    };
  }

  return {
    lastPaid: totalPaid,
    open: totalOpen,
    lastPaidFortnight,
  };
}

export async function getAnnualNet(userId: string, role: DashboardRole): Promise<AnnualNet> {
  const supabase = getSupabaseAdmin(); // Usar admin para acceder a todas las tablas
  const brokerId = role === "broker" ? await resolveBrokerId(userId) : null;

  // Para brokers: suma de comisiones del año usando fortnight_details (igual que gráficas YTD)
  if (role === "broker" && brokerId) {
    // Obtener código ASSA del broker
    const { data: brokerData } = await supabase
      .from('brokers')
      .select('assa_code')
      .eq('id', brokerId)
      .single();
    
    const assaCode = brokerData?.assa_code || null;
    
    console.log('📊 [getAnnualNet] Broker:', brokerId, 'ASSA Code:', assaCode);
    
    // Obtener quincenas del año actual
    const { data: fortnights } = await supabase
      .from('fortnights')
      .select('id, period_start, period_end')
      .gte('period_start', `${CURRENT_YEAR}-01-01`)
      .lte('period_end', `${CURRENT_YEAR}-12-31`)
      .in('status', ['PAID', 'READY']);
    
    if (!fortnights || fortnights.length === 0) {
      console.log('📊 [getAnnualNet] No hay quincenas del año', CURRENT_YEAR);
      return { value: 0 };
    }
    
    const fortnightIds = fortnights.map(f => f.id);
    console.log('📊 [getAnnualNet] Quincenas encontradas:', fortnightIds.length);
    
    // Buscar comisiones en fortnight_details (igual que actionGetYTDCommissions)
    let detailsQuery = supabase
      .from('fortnight_details')
      .select('commission_calculated')
      .in('fortnight_id', fortnightIds);
    
    // Filtrar por broker_id O assa_code (IGUAL QUE EN GRÁFICAS)
    if (assaCode) {
      detailsQuery = detailsQuery.or(`broker_id.eq.${brokerId},assa_code.eq.${assaCode}`);
      console.log('📊 [getAnnualNet] Filtrando por broker_id O assa_code');
    } else {
      detailsQuery = detailsQuery.eq('broker_id', brokerId);
      console.log('📊 [getAnnualNet] Filtrando solo por broker_id');
    }
    
    const { data, error } = await detailsQuery;
    
    if (error) {
      console.error('📊 [getAnnualNet] Error:', error);
      return { value: 0 };
    }
    
    const value = (data || []).reduce((acc: number, item: any) => {
      return acc + toNumber(item.commission_calculated);
    }, 0);
    
    console.log('📊 [getAnnualNet] Total calculado:', value, 'de', data?.length || 0, 'registros');
    
    // Si no hay datos reales, usar mock
    if (MOCK_DATA_ENABLED && value === 0) {
      return { value: 52340.75 };
    }
    
    return { value };
  }

  // Para master: suma de producción total (PMA)
  let query = supabase
    .from("production")
    .select("bruto, canceladas")
    .eq("year", CURRENT_YEAR)
    .limit(FETCH_LIMIT);

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
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  
  // YTD: Comparar solo meses CERRADOS (mes actual en curso no se cuenta)
  // Ejemplo: Si estamos en febrero 2026, comparar enero 2026 vs enero 2025 (febrero aún no cierra)
  // Si estamos en marzo 2026, comparar enero-febrero 2026 vs enero-febrero 2025
  const closedMonth = currentMonth - 1; // Mes anterior (ya cerrado)
  
  // Si estamos en enero (closedMonth = 0), usar año anterior completo
  if (closedMonth === 0) {
    const { data: previousYearData } = await supabase
      .from("production")
      .select("bruto, canceladas, month")
      .eq("year", currentYear - 1)
      .returns<{ bruto: number | string | null; canceladas: number | string | null; month: number }[]>();
    
    const totalPreviousYear = (previousYearData ?? []).reduce((acc, item) => {
      const bruto = toNumber(item.bruto);
      const canceladas = toNumber(item.canceladas);
      return acc + (bruto - canceladas);
    }, 0);
    
    const { data: twoYearsAgoData } = await supabase
      .from("production")
      .select("bruto, canceladas, month")
      .eq("year", currentYear - 2)
      .returns<{ bruto: number | string | null; canceladas: number | string | null; month: number }[]>();
    
    const totalTwoYearsAgo = (twoYearsAgoData ?? []).reduce((acc, item) => {
      const bruto = toNumber(item.bruto);
      const canceladas = toNumber(item.canceladas);
      return acc + (bruto - canceladas);
    }, 0);
    
    const deltaPercent = totalTwoYearsAgo > 0 ? ((totalPreviousYear - totalTwoYearsAgo) / totalTwoYearsAgo) * 100 : 0;
    
    console.log('[getProductionData] ENERO - Usando año completo anterior:', { 
      currentYear,
      closedMonth: 0,
      displayYear: currentYear - 1,
      totalPreviousYear,
      totalTwoYearsAgo,
      deltaPercent: deltaPercent.toFixed(1) + '%'
    });
    
    return {
      totalPMA: totalPreviousYear,
      previousTotal: totalTwoYearsAgo,
      deltaPercent,
      year: currentYear - 1
    };
  }
  
  // Get YTD PMA for current year (solo meses cerrados)
  const { data: currentYearData } = await supabase
    .from("production")
    .select("bruto, canceladas, month")
    .eq("year", currentYear)
    .lte("month", closedMonth) // Solo meses cerrados
    .returns<{ bruto: number | string | null; canceladas: number | string | null; month: number }[]>();
    
  const totalPMA = (currentYearData ?? []).reduce((acc, item) => {
    const bruto = toNumber(item.bruto);
    const canceladas = toNumber(item.canceladas);
    return acc + (bruto - canceladas);
  }, 0);
  
  // Get YTD total for previous year (mismos meses cerrados del año anterior)
  const { data: previousYearData } = await supabase
    .from("production")
    .select("bruto, canceladas, month")
    .eq("year", currentYear - 1)
    .lte("month", closedMonth) // Mismos meses cerrados
    .returns<{ bruto: number | string | null; canceladas: number | string | null; month: number }[]>();
    
  const previousTotal = (previousYearData ?? []).reduce((acc, item) => {
    const bruto = toNumber(item.bruto);
    const canceladas = toNumber(item.canceladas);
    return acc + (bruto - canceladas);
  }, 0);
  
  // FALLBACK: Si no hay datos del año actual, usar datos del año anterior
  const hasCurrentYearData = totalPMA > 0;
  const displayYear = hasCurrentYearData ? currentYear : currentYear - 1;
  const displayTotal = hasCurrentYearData ? totalPMA : previousTotal;
  
  // Para comparación: si estamos mostrando año anterior, comparar con 2 años atrás (YTD)
  let comparisonTotal = previousTotal;
  if (!hasCurrentYearData) {
    const { data: twoYearsAgoData } = await supabase
      .from("production")
      .select("bruto, canceladas, month")
      .eq("year", currentYear - 2)
      .lte("month", closedMonth) // Mismos meses cerrados
      .returns<{ bruto: number | string | null; canceladas: number | string | null; month: number }[]>();
    
    comparisonTotal = (twoYearsAgoData ?? []).reduce((acc, item) => {
      const bruto = toNumber(item.bruto);
      const canceladas = toNumber(item.canceladas);
      return acc + (bruto - canceladas);
    }, 0);
  }
  
  const deltaPercent = comparisonTotal > 0 ? ((displayTotal - comparisonTotal) / comparisonTotal) * 100 : 0;
  
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthRange = closedMonth === 1 ? monthNames[0] : `${monthNames[0]}-${monthNames[closedMonth - 1]}`;
  
  console.log('[getProductionData] YTD COMPARISON (CLOSED MONTHS):', { 
    currentYear,
    currentMonth,
    closedMonth,
    monthRange,
    hasCurrentYearData, 
    displayYear, 
    displayTotal, 
    comparisonTotal,
    deltaPercent: deltaPercent.toFixed(1) + '%'
  });
  
  return {
    totalPMA: displayTotal,
    previousTotal: comparisonTotal,
    deltaPercent,
    year: displayYear
  };
}

// Get broker ranking for Master dashboard
export async function getBrokerRanking() {
  // Usar admin para obtener todos los datos sin restricciones de RLS
  const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
  const supabase = await getSupabaseAdmin();
  
  const now = new Date();
  const actualMonth = now.getMonth() + 1; // 1-12 (mes actual)
  const currentYear = now.getFullYear();
  
  // Usar el último mes CERRADO (no el actual que puede no tener datos)
  const closedMonth = actualMonth === 1 ? 12 : actualMonth - 1; // Mes cerrado anterior
  const previousClosedMonth = closedMonth === 1 ? 12 : closedMonth - 1; // Mes anterior al cerrado
  
  console.log('[RANKING MONTHS]', { 
    actualMonth, 
    closedMonth, 
    previousClosedMonth 
  });
  
  // FALLBACK: Intentar primero con año actual, si no hay datos usar año anterior
  let { data, error } = await (supabase as any)
    .from("production")
    .select(`
      broker_id,
      bruto,
      canceladas_ytd,
      month,
      brokers!production_broker_id_fkey (
        id,
        name
      )
    `)
    .eq("year", CURRENT_YEAR)
    .lte("month", closedMonth);
  
  console.log('[MASTER RANKING DEBUG - Current Year]', { dataLength: data?.length, error });
  
  // Si no hay datos del año actual, usar año anterior completo
  let yearUsed = CURRENT_YEAR;
  if (!data || data.length === 0) {
    const result = await (supabase as any)
      .from("production")
      .select(`
        broker_id,
        bruto,
        canceladas_ytd,
        month,
        brokers!production_broker_id_fkey (
          id,
          name
        )
      `)
      .eq("year", CURRENT_YEAR - 1);
    
    data = result.data;
    error = result.error;
    yearUsed = CURRENT_YEAR - 1;
    console.log('[MASTER RANKING DEBUG - Fallback to Previous Year]', { 
      dataLength: data?.length, 
      error, 
      yearUsed 
    });
  }
  
  if (!data || data.length === 0) return [];
  
  // YTD hasta el mes cerrado actual (enero-octubre)
  const ytdCurrentClosedMap = new Map<string, { name: string; bruto: number; canceladas_ytd: number }>();
  // YTD hasta el mes cerrado anterior (enero-septiembre)
  const ytdPreviousClosedMap = new Map<string, { name: string; bruto: number; canceladas_ytd: number }>();
  
  data.forEach((item: any) => {
    const brokerId = item.broker_id;
    const brokerName = item.brokers?.name || 'Sin nombre';
    const bruto = parseFloat(item.bruto) || 0;
    const canceladas_ytd = parseFloat(item.canceladas_ytd) || 0;
    const month = item.month;
    
    // YTD acumulado hasta mes cerrado actual (enero-octubre)
    if (month <= closedMonth) {
      if (!ytdCurrentClosedMap.has(brokerId)) {
        ytdCurrentClosedMap.set(brokerId, { name: brokerName, bruto: 0, canceladas_ytd: 0 });
      }
      const broker = ytdCurrentClosedMap.get(brokerId)!;
      broker.bruto += bruto;
      // canceladas_ytd es anual, tomar el valor (debería ser el mismo en todos los meses)
      broker.canceladas_ytd = canceladas_ytd;
    }
    
    // YTD acumulado hasta mes cerrado anterior (enero-septiembre)
    if (month <= previousClosedMonth) {
      if (!ytdPreviousClosedMap.has(brokerId)) {
        ytdPreviousClosedMap.set(brokerId, { name: brokerName, bruto: 0, canceladas_ytd: 0 });
      }
      const prevBroker = ytdPreviousClosedMap.get(brokerId)!;
      prevBroker.bruto += bruto;
      // canceladas_ytd es anual, tomar el valor
      prevBroker.canceladas_ytd = canceladas_ytd;
    }
  });
  
  // Convertir a array y ordenar - YTD hasta mes cerrado actual (enero-octubre)
  const ytdCurrentClosedRows = Array.from(ytdCurrentClosedMap.entries()).map(([id, data]) => ({
    brokerId: id,
    brokerName: data.name,
    total: data.bruto - data.canceladas_ytd, // Neto = bruto acumulado - canceladas anuales
  }));
  
  ytdCurrentClosedRows.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    return a.brokerName.localeCompare(b.brokerName);
  });
  
  // Convertir a array y ordenar - YTD hasta mes cerrado anterior (enero-septiembre)
  const ytdPreviousClosedRows = Array.from(ytdPreviousClosedMap.entries()).map(([id, data]) => ({
    brokerId: id,
    brokerName: data.name,
    total: data.bruto - data.canceladas_ytd, // Neto = bruto acumulado - canceladas anuales
  }));
  
  ytdPreviousClosedRows.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    return a.brokerName.localeCompare(b.brokerName);
  });
  
  // Crear mapas de posiciones YTD
  const ytdCurrentClosedPositions = new Map<string, number>();
  ytdCurrentClosedRows.forEach((broker, index) => {
    ytdCurrentClosedPositions.set(broker.brokerId, index + 1);
  });
  
  const ytdPreviousClosedPositions = new Map<string, number>();
  ytdPreviousClosedRows.forEach((broker, index) => {
    ytdPreviousClosedPositions.set(broker.brokerId, index + 1);
  });
  
  // Top 5 basado en YTD actual con indicador de cambio vs YTD anterior
  const top5 = ytdCurrentClosedRows.slice(0, 5).map((broker, currentIndex) => {
    const currentYtdPosition = ytdCurrentClosedPositions.get(broker.brokerId);
    const previousYtdPosition = ytdPreviousClosedPositions.get(broker.brokerId);
    
    let positionChange: 'up' | 'down' | 'same' | 'new' = 'same';
    let positionDiff = 0;
    
    if (previousYtdPosition === undefined) {
      // No estaba en el ranking YTD anterior - es nuevo
      positionChange = 'new';
      positionDiff = 0;
    } else if (currentYtdPosition === undefined) {
      // No está en el ranking actual (raro, pero por si acaso)
      positionChange = 'same';
      positionDiff = 0;
    } else {
      // Comparar posiciones YTD: anterior vs actual
      positionDiff = previousYtdPosition - currentYtdPosition;
      if (positionDiff > 0) {
        positionChange = 'up'; // Subió en el ranking YTD
      } else if (positionDiff < 0) {
        positionChange = 'down'; // Bajó en el ranking YTD
      } else {
        positionChange = 'same'; // Se mantuvo
      }
    }
    
    return {
      brokerId: broker.brokerId,
      brokerName: broker.brokerName,
      total: broker.total,
      positionChange,
      positionDiff: Math.abs(positionDiff),
    };
  });
  
  console.log('[MASTER RANKING RESULT]', { 
    actualMonth,
    closedMonth, 
    previousClosedMonth,
    ytdCurrentClosed: `enero-${closedMonth}`,
    ytdPreviousClosed: `enero-${previousClosedMonth}`,
    brokersYtdCurrent: ytdCurrentClosedRows.length,
    brokersYtdPrevious: ytdPreviousClosedRows.length,
    top5Count: top5.length, 
    top5WithPositions: top5.map(b => ({
      name: b.brokerName,
      ytdCurrentPos: ytdCurrentClosedPositions.get(b.brokerId),
      ytdPreviousPos: ytdPreviousClosedPositions.get(b.brokerId),
      change: b.positionChange,
      diff: b.positionDiff
    }))
  });
  
  // Log adicional para debug
  console.log('[YTD POSITIONS]', {
    ytdCurrentTop10: Array.from(ytdCurrentClosedPositions.entries()).slice(0, 10),
    ytdPreviousTop10: Array.from(ytdPreviousClosedPositions.entries()).slice(0, 10)
  });
  
  return top5;
}

// Get broker of the month (previous closed month)
export async function getBrokerOfTheMonth(): Promise<{ brokerName: string; month: string; monthName: string } | null> {
  // Usar admin para obtener todos los datos sin restricciones de RLS
  const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
  const supabase = await getSupabaseAdmin();
  
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  
  // Regla "mes cerrado": día 1 verificar si hay datos del mes actual, sino mes anterior
  let targetMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  let targetYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  
  if (currentDay === 1) {
    // Verificar si hay datos del mes actual
    const { data: checkCurrent } = await supabase
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
  
  let { data } = await supabase
    .from("production")
    .select(`
      broker_id,
      bruto,
      brokers!production_broker_id_fkey (
        id,
        name
      )
    `)
    .eq("year", targetYear)
    .eq("month", targetMonth); // month es INTEGER 1-12
  
  // FALLBACK: Si no hay datos del mes objetivo, buscar el último mes con datos del año anterior
  if (!data || data.length === 0) {
    console.log('[BROKER OF THE MONTH] No hay datos para el mes', { targetYear, targetMonth });
    
    // Buscar último mes con datos del año anterior
    const { data: lastMonthData } = await supabase
      .from("production")
      .select(`
        broker_id,
        bruto,
        month,
        brokers!production_broker_id_fkey (
          id,
          name
        )
      `)
      .eq("year", currentYear - 1)
      .order("month", { ascending: false })
      .limit(100);
    
    if (lastMonthData && lastMonthData.length > 0) {
      // Obtener el mes más reciente
      const lastMonth = Math.max(...lastMonthData.map((d: any) => d.month));
      data = lastMonthData.filter((d: any) => d.month === lastMonth);
      targetMonth = lastMonth;
      targetYear = currentYear - 1;
      console.log('[BROKER OF THE MONTH] Usando fallback:', { targetYear, targetMonth, dataLength: data.length });
    } else {
      return null;
    }
  }
  
  if (!data || data.length === 0) {
    console.log('[BROKER OF THE MONTH] No hay datos disponibles');
    return null;
  }
  
  // Calcular PMA BRUTO del mes por broker (SIN restar canceladas)
  // Las canceladas son anuales y no se sabe a qué mes exacto corresponden
  const brokers = data.map((item: any) => ({
    broker_id: item.broker_id,
    broker_name: item.brokers?.name || 'Sin nombre',
    pma_bruto: parseFloat(item.bruto) || 0
  }));
  
  console.log('[BROKER OF THE MONTH] Brokers encontrados:', brokers.length);
  
  // Ordenar: descendente por PMA Bruto, en empate alfabético
  brokers.sort((a: any, b: any) => {
    if (b.pma_bruto !== a.pma_bruto) {
      return b.pma_bruto - a.pma_bruto;
    }
    return a.broker_name.localeCompare(b.broker_name);
  });
  
  const winner = brokers[0];
  if (!winner) {
    console.log('[BROKER OF THE MONTH] No hay ganador');
    return null;
  }
  
  console.log('[BROKER OF THE MONTH] Ganador:', { 
    name: winner.broker_name, 
    amount: winner.pma_bruto,
    month: monthNames[targetMonth - 1]
  });
  
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
  
  // Get checks data - CORREGIDO según lógica real
  const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
  const adminClient = await getSupabaseAdmin();
  
  // 1. Total Recibido: suma total del historial banco
  const { data: transfers } = await adminClient
    .from('bank_transfers')
    .select('amount, used_amount');
  
  const received = (transfers || []).reduce((sum, t) => sum + toNumber(t.amount), 0);
  
  // 2. Total Aplicado: suma de used_amount del historial banco
  const applied = (transfers || []).reduce((sum, t) => sum + toNumber(t.used_amount), 0);
  
  // 3. Pendientes: suma de pending_payments con status='pending'
  const { data: pendingPayments } = await adminClient
    .from('pending_payments')
    .select('amount_to_pay')
    .eq('status', 'pending');
  
  const pending = (pendingPayments || []).reduce((sum, p) => sum + toNumber(p.amount_to_pay), 0);
  
  // 4. Devoluciones: pending_payments tipo 'devolucion' con status='paid'
  const { data: devolutions } = await adminClient
    .from('pending_payments')
    .select('amount_to_pay')
    .eq('purpose', 'devolucion')
    .eq('status', 'paid');
  
  const returned = (devolutions || []).reduce((sum, d) => sum + toNumber(d.amount_to_pay), 0);
  
  console.log('[DASHBOARD CHECKS STATS]', { received, applied, pending, returned });
  
  return {
    lastPaidAmount,
    annualAccumulated,
    checks: {
      received,
      applied,
      pending,
      returned
    }
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

  // GRÁFICAS: Mostrar todos los 12 meses del año (no filtrar por mes actual)
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

  let currentTotals = aggregateMonthlyTotals(currentData);
  let previousTotals = aggregateMonthlyTotals(previousData);
  
  // FALLBACK: Si no hay datos del año actual, usar año anterior como "current" y 2 años atrás como "previous"
  if (currentTotals.length === 0 && previousTotals.length > 0) {
    console.log('[getYtdComparison] FALLBACK: Usando año anterior como current');
    const { data: twoYearsAgoData } = await buildQuery(previousYear - 1).returns<{ month: number | null; bruto: number | string | null; canceladas: number | string | null }[]>();
    currentTotals = previousTotals;
    previousTotals = aggregateMonthlyTotals(twoYearsAgoData);
  }
  
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
  const supabaseServer = await getSupabaseServer();
  const profile = await getProfile(userId);
  const brokerId = profile?.brokerId ?? null;

  // Usar admin para obtener todos los datos sin restricciones de RLS
  const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
  const supabase = await getSupabaseAdmin();
  
  const now = new Date();
  const actualMonth = now.getMonth() + 1; // 1-12
  
  // Usar el último mes CERRADO (no el actual que puede no tener datos)
  const closedMonth = actualMonth === 1 ? 12 : actualMonth - 1;
  const previousClosedMonth = closedMonth === 1 ? 12 : closedMonth - 1;

  const { data, error } = await supabase
    .from("production")
    .select("broker_id, bruto, canceladas_ytd, month")
    .eq("year", CURRENT_YEAR)
    .lte("month", closedMonth)
    .limit(FETCH_LIMIT)
    .returns<{ broker_id: string | null; bruto: number | string | null; canceladas_ytd: number | string | null; month: number }[]>();
  
  console.log('[RANKING DEBUG]', { dataLength: data?.length, error });

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

  // YTD hasta mes cerrado actual
  const ytdCurrentClosedMap = new Map<string, { bruto: number; canceladas_ytd: number }>();
  // YTD hasta mes cerrado anterior
  const ytdPreviousClosedMap = new Map<string, { bruto: number; canceladas_ytd: number }>();
  
  data.forEach((item: { broker_id: string | null; bruto: number | string | null; canceladas_ytd: number | string | null; month: number }) => {
    if (!item.broker_id) return;
    const bruto = toNumber(item.bruto);
    const canceladas_ytd = toNumber(item.canceladas_ytd);
    const month = item.month;
    
    // YTD acumulado hasta mes cerrado actual
    if (month <= closedMonth) {
      if (!ytdCurrentClosedMap.has(item.broker_id)) {
        ytdCurrentClosedMap.set(item.broker_id, { bruto: 0, canceladas_ytd: 0 });
      }
      const broker = ytdCurrentClosedMap.get(item.broker_id)!;
      broker.bruto += bruto;
      broker.canceladas_ytd = canceladas_ytd; // Anual, tomar el valor
    }
    
    // YTD acumulado hasta mes cerrado anterior
    if (month <= previousClosedMonth) {
      if (!ytdPreviousClosedMap.has(item.broker_id)) {
        ytdPreviousClosedMap.set(item.broker_id, { bruto: 0, canceladas_ytd: 0 });
      }
      const prevBroker = ytdPreviousClosedMap.get(item.broker_id)!;
      prevBroker.bruto += bruto;
      prevBroker.canceladas_ytd = canceladas_ytd; // Anual, tomar el valor
    }
  });

  const rows = Array.from(ytdCurrentClosedMap.entries()).map(([id, data]) => ({ 
    broker_id: id, 
    total: data.bruto - data.canceladas_ytd // Neto = bruto acumulado - canceladas anuales
  }));
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
    .sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return (nameMap.get(a.brokerId) ?? "").localeCompare(nameMap.get(b.brokerId) ?? "");
    });

  if (ranking.length < 5) {
    const { data: extraBrokers } = await supabase
      .from("brokers")
      .select("id, name")
      .limit(10)
      .returns<{ id: string | null; name: string | null }[]>();

    (extraBrokers ?? []).forEach((broker) => {
      if (!broker?.id) return;
      if (ranking.some((item) => item.brokerId === broker.id)) return;
      ranking.push({ brokerId: broker.id, brokerName: broker.name ?? "", total: 0 });
    });
  }

  // Ranking YTD hasta mes cerrado anterior
  const ytdPreviousClosedRows = Array.from(ytdPreviousClosedMap.entries()).map(([id, data]) => ({ 
    broker_id: id, 
    total: data.bruto - data.canceladas_ytd 
  }));
  ytdPreviousClosedRows.sort((a, b) => b.total - a.total);
  
  // Crear mapas de posiciones YTD
  const ytdCurrentClosedPositions = new Map<string, number>();
  ranking.forEach((broker, index) => {
    ytdCurrentClosedPositions.set(broker.brokerId, index + 1);
  });
  
  const ytdPreviousClosedPositions = new Map<string, number>();
  ytdPreviousClosedRows.forEach((broker, index) => {
    ytdPreviousClosedPositions.set(broker.broker_id, index + 1);
  });
  
  const entries: RankingEntry[] = ranking.slice(0, 5).map((item, index) => {
    const currentYtdPosition = ytdCurrentClosedPositions.get(item.brokerId);
    const previousYtdPosition = ytdPreviousClosedPositions.get(item.brokerId);
    
    let positionChange: 'up' | 'down' | 'same' | 'new' = 'same';
    let positionDiff = 0;
    
    if (previousYtdPosition === undefined) {
      // No estaba en el ranking YTD anterior - es nuevo
      positionChange = 'new';
      positionDiff = 0;
    } else if (currentYtdPosition === undefined) {
      // No está en el ranking actual
      positionChange = 'same';
      positionDiff = 0;
    } else {
      // Comparar posiciones YTD
      positionDiff = previousYtdPosition - currentYtdPosition;
      if (positionDiff > 0) {
        positionChange = 'up';
      } else if (positionDiff < 0) {
        positionChange = 'down';
      } else {
        positionChange = 'same';
      }
    }
    
    return {
      brokerId: item.brokerId,
      brokerName: item.brokerName,
      position: Number(index + 1), // asegurar que position sea number
      positionChange,
      positionDiff: Math.abs(positionDiff),
      total: item.total, // ✅ Incluir total para todos los brokers del Top 5
    };
  });

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

  console.log('[BROKER RANKING TOP5 RESULT]', { 
    actualMonth,
    closedMonth, 
    previousClosedMonth,
    ytdCurrentClosed: `enero-${closedMonth}`,
    ytdPreviousClosed: `enero-${previousClosedMonth}`,
    entriesCount: entries.length, 
    entriesWithPositions: entries.map(e => ({
      name: e.brokerName,
      ytdCurrentPos: ytdCurrentClosedPositions.get(e.brokerId),
      ytdPreviousPos: ytdPreviousClosedPositions.get(e.brokerId),
      change: e.positionChange,
      diff: e.positionDiff
    }))
  });
  
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
  const CURRENT_YEAR = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  // Obtener configuración de contests
  const { data: assaConfigData, error: assaError } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'production.contests.assa')
    .single();

  const { data: convivioConfigData, error: convivioError } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'production.contests.convivio')
    .single();

  console.log('[CONTESTS RAW DATA]', {
    assaConfigData,
    assaError,
    convivioConfigData,
    convivioError,
  });

  const assaConfig = (typeof assaConfigData?.value === 'object' && assaConfigData?.value !== null)
    ? assaConfigData.value as any
    : { start_month: 1, end_month: 12, goal: 250000, goal_double: 400000, enable_double_goal: false, year: currentYear };

  const convivioConfig = (typeof convivioConfigData?.value === 'object' && convivioConfigData?.value !== null)
    ? convivioConfigData.value as any
    : { start_month: 1, end_month: 12, goal: 150000, goal_double: 250000, enable_double_goal: true, year: currentYear };

  // Debug: Log configuraciones
  console.log('[CONTESTS DEBUG] Current Date:', { currentYear, currentMonth });
  console.log('[CONTESTS DEBUG] ASSA Config:', assaConfig);
  console.log('[CONTESTS DEBUG] Convivio Config:', convivioConfig);

  // Determinar año de concurso (puede ser diferente al año actual si se reseteó)
  const assaYear = assaConfig.year ?? currentYear;
  const convivioYear = convivioConfig.year ?? currentYear;

  // Generar arrays de meses para cada concurso
  const buildMonthsRange = (start: number, end: number) => {
    if (start <= end) {
      return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
    }
    // Rango cruzando el año: ejemplo start=9, end=3 => 9..12 y 1..3
    const firstSegment = Array.from({ length: 12 - start + 1 }, (_, idx) => start + idx);
    const secondSegment = Array.from({ length: end }, (_, idx) => idx + 1);
    return [...firstSegment, ...secondSegment];
  };

  const convivioMonths = buildMonthsRange(convivioConfig.start_month, convivioConfig.end_month);
  const assaMonths = buildMonthsRange(assaConfig.start_month, assaConfig.end_month);

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

  console.log('[ASSA STATUS]', { isAssaActive, assaPassed, assaFuture, assaValue });

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

  console.log('[ASSA FINAL]', { assaStatus, assaQuotaType });

  // Determinar estado de Convivio
  let convivioStatus: 'active' | 'closed' | 'won' | 'lost' = 'active';
  let convivioQuotaType: 'single' | 'double' | undefined = undefined;

  const isConvivioActive = currentYear === convivioYear && currentMonth >= convivioConfig.start_month && currentMonth <= convivioConfig.end_month;
  const convivioPassed = currentYear > convivioYear || (currentYear === convivioYear && currentMonth > convivioConfig.end_month);
  const convivioFuture = currentYear < convivioYear || (currentYear === convivioYear && currentMonth < convivioConfig.start_month);

  console.log('[CONVIVIO STATUS]', { isConvivioActive, convivioPassed, convivioFuture, convivioValue });

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

  console.log('[CONVIVIO FINAL]', { convivioStatus, convivioQuotaType });

  const convivioPercent = computePercent(convivioValue, convivioConfig.goal);
  const assaPercent = computePercent(assaValue, assaConfig.goal);

  const result = [
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
      periodLabel: `${MONTH_NAMES[assaConfig.start_month - 1] ?? ""} - ${MONTH_NAMES[assaConfig.end_month - 1] ?? ""}`,
      startMonth: assaConfig.start_month,
      endMonth: assaConfig.end_month,
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
      enableDoubleGoal: convivioConfig.enable_double_goal ?? true,
      periodLabel: `${MONTH_NAMES[convivioConfig.start_month - 1] ?? ""} - ${MONTH_NAMES[convivioConfig.end_month - 1] ?? ""}`,
      startMonth: convivioConfig.start_month,
      endMonth: convivioConfig.end_month,
    },
  ];

  console.log('[CONTESTS RETURN]', result);
  
  return result;
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
