// /pages/api/dashboard/broker.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { startOfMonth, endOfMonth, formatISO } from 'date-fns';

type Role = 'master' | 'broker';

interface ApiOk {
  ok: true;
  data: {
    // KPIs
    lastFortnightAmount: number;  // "Última quincena"
    morosityOver60: number;       // Morosidad +60
    pendingIdentify: number;      // Pendientes de identificar

    // Donuts
    convivio: { current: number; goal: number; split?: number }; // split = marca intermedia
    assa:     { current: number; goal: number };

    // Mini calendario (eventos del mes)
    calendar: { date: string; count: number; titleList: string[] }[];

    // Barras producción mensual (año actual)
    production: { month: number; y2024?: number; y2025?: number; goal?: number }[];
  };
}

interface ApiErr { ok: false; error: string }
type ApiRes = ApiOk | ApiErr;

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiRes>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // 1) Usuario -> profile -> broker_id
    const userId = req.headers['x-user-id'] as string | undefined; // tu middleware puede enviarlo
    if (!userId) return res.status(401).json({ ok: false, error: 'No auth user' });

    const { data: profile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, broker_id, email, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!profile || profile.role !== 'broker') {
      return res.status(403).json({ ok: false, error: 'Rol no permitido' });
    }

    const brokerId: string = profile.broker_id;

    // 2) Última quincena cerrada
    const { data: lastFt, error: fErr } = await supabaseAdmin
      .from('fortnights')
      .select('id, year, period_num, end_date')
      .eq('status', 'closed')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fErr) throw fErr;

    // 3) KPI "Última quincena" (commissions)
    let lastFortnightAmount = 0;
    if (lastFt?.id) {
      const { data: com, error: cErr } = await supabaseAdmin
        .from('commissions')
        .select('total_amount')
        .eq('fortnight_id', lastFt.id)
        .eq('broker_id', brokerId)
        .maybeSingle();
      if (cErr) throw cErr;
      lastFortnightAmount = Number(com?.total_amount ?? 0);
    }

    // 4) KPI morosidad +60 y pendientes identificar (vienen de tu tabla de métricas acumuladas para el corte)
    const { data: metrics, error: mErr } = await supabaseAdmin
      .from('metrics_broker')
      .select('morosity_over_60, pending_identify')
      .eq('broker_id', brokerId)
      .order('fortnight_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mErr) throw mErr;

    // 5) Progreso de concursos (ruletas) – año actual:
    const year = new Date().getFullYear();

    const { data: conv, error: cvErr } = await supabaseAdmin
      .from('convivio_progress')
      .select('current, goal, split')
      .eq('broker_id', brokerId)
      .eq('year', year)
      .maybeSingle();
    if (cvErr) throw cvErr;

    const { data: assa, error: asErr } = await supabaseAdmin
      .from('assa_progress')
      .select('current, goal')
      .eq('broker_id', brokerId)
      .eq('year', year)
      .maybeSingle();
    if (asErr) throw asErr;

    // 6) Mini-calendario – eventos del mes actual
    const now = new Date();
    const t0 = formatISO(startOfMonth(now));
    const t1 = formatISO(endOfMonth(now));
    const { data: evs, error: eErr } = await supabaseAdmin
      .from('events')
      .select('date, title')
      .gte('date', t0)
      .lte('date', t1)
      .order('date', { ascending: true });
    if (eErr) throw eErr;

    const calendarMap = new Map<string, string[]>();
    for (const e of evs ?? []) {
      const k = e.date.slice(0, 10);
      const arr = calendarMap.get(k) ?? [];
      arr.push(e.title);
      calendarMap.set(k, arr);
    }
    const calendar = Array.from(calendarMap.entries()).map(([date, titleList]) => ({
      date, count: titleList.length, titleList
    }));

    // 7) Producción mensual (barras) – tomamos 2024 y 2025 si existen
    const { data: prod, error: prErr } = await supabaseAdmin
      .from('production_monthly')
      .select('year, month, amount, goal')
      .eq('broker_id', brokerId)
      .in('year', [2024, 2025])
      .order('year', { ascending: true })
      .order('month', { ascending: true });
    if (prErr) throw prErr;

    const byMonth: Record<number, { y2024?: number; y2025?: number; goal?: number }> = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = {};
    for (const r of prod ?? []) {
      const slot = byMonth[r.month] ?? {};
      if (r.year === 2024) slot.y2024 = Number(r.amount ?? 0);
      if (r.year === 2025) slot.y2025 = Number(r.amount ?? 0);
      if (r.goal != null) slot.goal = Number(r.goal);
      byMonth[r.month] = slot;
    }
    const production = Object.entries(byMonth).map(([m, v]) => ({
      month: Number(m), ...v
    }));

    return res.status(200).json({
      ok: true,
      data: {
        lastFortnightAmount,
        morosityOver60: Number(metrics?.morosity_over_60 ?? 0),
        pendingIdentify: Number(metrics?.pending_identify ?? 0),
        convivio: {
          current: Number(conv?.current ?? 0),
          goal: Number(conv?.goal ?? 0),
          split: conv?.split != null ? Number(conv.split) : undefined
        },
        assa: {
          current: Number(assa?.current ?? 0),
          goal: Number(assa?.goal ?? 0)
        },
        calendar,
        production
      }
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
}
