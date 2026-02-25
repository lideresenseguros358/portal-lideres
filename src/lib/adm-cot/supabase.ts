/**
 * ADM COT — Supabase server actions (data access layer)
 * All queries run server-side with RLS (master-only policies)
 */
'use server';

import { getSupabaseServer } from '@/lib/supabase/server';
import type {
  AdmCotQuote,
  AdmCotExpediente,
  AdmCotPayment,
  AdmCotPaymentGroup,
  AdmCotBankHistory,
  AdmCotRecurrence,
  AdmCotChat,
  AdmCotKpiSnapshot,
  AdmCotFilters,
  AdmCotPagination,
} from '@/types/adm-cot.types';

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function buildDateFilter(query: any, filters: AdmCotFilters, dateCol: string) {
  if (filters.dateFrom) query = query.gte(dateCol, filters.dateFrom);
  if (filters.dateTo) query = query.lte(dateCol, filters.dateTo + 'T23:59:59');
  return query;
}

// ════════════════════════════════════════════
// 1. COTIZACIONES
// ════════════════════════════════════════════

export async function getQuotes(
  filters: AdmCotFilters = {},
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 25 }
): Promise<Result<{ rows: AdmCotQuote[]; total: number }>> {
  try {
    const supabase = await getSupabaseServer();
    let query = supabase.from('adm_cot_quotes').select('*', { count: 'exact' });

    query = buildDateFilter(query, filters, 'quoted_at');
    if (filters.insurer) query = query.eq('insurer', filters.insurer);
    if (filters.ramo) query = query.eq('ramo', filters.ramo);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.region) query = query.eq('region', filters.region);
    if (filters.search) {
      query = query.or(
        `client_name.ilike.%${filters.search}%,cedula.ilike.%${filters.search}%,email.ilike.%${filters.search}%,quote_ref.ilike.%${filters.search}%`
      );
    }

    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    query = query.order('quoted_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return { ok: true, data: { rows: (data ?? []) as unknown as AdmCotQuote[], total: count ?? 0 } };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function getQuoteById(id: string): Promise<Result<AdmCotQuote>> {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from('adm_cot_quotes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return { ok: true, data: data as unknown as AdmCotQuote };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════
// 2. EXPEDIENTES
// ════════════════════════════════════════════

export async function getExpedientes(
  filters: AdmCotFilters = {},
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 25 }
): Promise<Result<{ rows: AdmCotExpediente[]; total: number }>> {
  try {
    const supabase = await getSupabaseServer();
    let query = supabase.from('adm_cot_expedientes').select('*', { count: 'exact' });

    query = buildDateFilter(query, filters, 'emitted_at');
    if (filters.insurer) query = query.eq('insurer', filters.insurer);
    if (filters.ramo) query = query.eq('ramo', filters.ramo);
    if (filters.search) {
      query = query.or(
        `client_name.ilike.%${filters.search}%,cedula.ilike.%${filters.search}%,nro_poliza.ilike.%${filters.search}%`
      );
    }

    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    query = query.order('emitted_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return { ok: true, data: { rows: (data ?? []) as unknown as AdmCotExpediente[], total: count ?? 0 } };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function getExpedienteById(id: string): Promise<Result<AdmCotExpediente>> {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from('adm_cot_expedientes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return { ok: true, data: data as unknown as AdmCotExpediente };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════
// 3. PAGOS
// ════════════════════════════════════════════

export async function getPayments(
  filters: AdmCotFilters & { paymentStatus?: string } = {},
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 25 }
): Promise<Result<{ rows: AdmCotPayment[]; total: number }>> {
  try {
    const supabase = await getSupabaseServer();
    let query = supabase.from('adm_cot_payments').select('*', { count: 'exact' });

    query = buildDateFilter(query, filters, 'created_at');
    if (filters.insurer) query = query.eq('insurer', filters.insurer);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) {
      query = query.or(
        `client_name.ilike.%${filters.search}%,cedula.ilike.%${filters.search}%,nro_poliza.ilike.%${filters.search}%`
      );
    }

    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return { ok: true, data: { rows: (data ?? []) as unknown as AdmCotPayment[], total: count ?? 0 } };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function getPaymentGroups(): Promise<Result<AdmCotPaymentGroup[]>> {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from('adm_cot_payment_groups')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as unknown as AdmCotPaymentGroup[] };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function getBankHistory(
  filters: AdmCotFilters = {}
): Promise<Result<AdmCotBankHistory[]>> {
  try {
    const supabase = await getSupabaseServer();
    let query = supabase.from('adm_cot_bank_history').select('*');
    query = buildDateFilter(query, filters, 'executed_at');
    if (filters.search) {
      query = query.ilike('bank_reference', `%${filters.search}%`);
    }
    query = query.order('executed_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: (data ?? []) as unknown as AdmCotBankHistory[] };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════
// 4. RECURRENCIAS
// ════════════════════════════════════════════

export async function getRecurrences(
  filters: AdmCotFilters & { recurrenceStatus?: string } = {}
): Promise<Result<AdmCotRecurrence[]>> {
  try {
    const supabase = await getSupabaseServer();
    let query = supabase.from('adm_cot_recurrences').select('*');
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.insurer) query = query.eq('insurer', filters.insurer);
    if (filters.search) {
      query = query.or(
        `client_name.ilike.%${filters.search}%,nro_poliza.ilike.%${filters.search}%`
      );
    }
    query = query.order('next_due_date', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: (data ?? []) as unknown as AdmCotRecurrence[] };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════
// 5. CHATS
// ════════════════════════════════════════════

export async function getChats(
  filters: AdmCotFilters & { classification?: string } = {},
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 25 }
): Promise<Result<{ rows: AdmCotChat[]; total: number }>> {
  try {
    const supabase = await getSupabaseServer();
    let query = supabase.from('adm_cot_chats').select('*', { count: 'exact' });

    query = buildDateFilter(query, filters, 'started_at');
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) {
      query = query.or(
        `phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%,cedula.ilike.%${filters.search}%`
      );
    }

    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    query = query.order('last_message_at', { ascending: false, nullsFirst: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return { ok: true, data: { rows: (data ?? []) as unknown as AdmCotChat[], total: count ?? 0 } };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function getChatById(id: string): Promise<Result<AdmCotChat>> {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from('adm_cot_chats')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return { ok: true, data: data as unknown as AdmCotChat };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════
// 6. DASHBOARD KPIs
// ════════════════════════════════════════════

export async function getLatestKpiSnapshot(
  environment: string = 'development'
): Promise<Result<AdmCotKpiSnapshot | null>> {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from('adm_cot_kpi_snapshots')
      .select('*')
      .eq('environment', environment)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { ok: true, data: data as unknown as AdmCotKpiSnapshot | null };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/** Live KPIs computed directly from tables (fallback when no snapshot) */
export async function computeLiveKpis(): Promise<Result<{
  quotesToday: number;
  quotesWeek: number;
  quotesMonth: number;
  emissionsToday: number;
  emissionsMonth: number;
  pendingPaymentsTotal: number;
  refundsTotal: number;
}>> {
  try {
    const supabase = await getSupabaseServer();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

    const [qToday, qWeek, qMonth, eToday, eMonth, pendPay, refunds] = await Promise.all([
      supabase.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).gte('quoted_at', todayStr),
      supabase.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).gte('quoted_at', weekAgo),
      supabase.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).gte('quoted_at', monthAgo),
      supabase.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).eq('status', 'EMITIDA').gte('emitted_at', todayStr),
      supabase.from('adm_cot_quotes').select('id', { count: 'exact', head: true }).eq('status', 'EMITIDA').gte('emitted_at', monthAgo),
      supabase.from('adm_cot_payments').select('amount').eq('status', 'PENDIENTE'),
      supabase.from('adm_cot_payments').select('amount').eq('is_refund', true),
    ]);

    const sumAmounts = (rows: any[] | null) => (rows ?? []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    return {
      ok: true,
      data: {
        quotesToday: qToday.count ?? 0,
        quotesWeek: qWeek.count ?? 0,
        quotesMonth: qMonth.count ?? 0,
        emissionsToday: eToday.count ?? 0,
        emissionsMonth: eMonth.count ?? 0,
        pendingPaymentsTotal: sumAmounts(pendPay.data),
        refundsTotal: sumAmounts(refunds.data),
      },
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
