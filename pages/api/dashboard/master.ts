// /pages/api/dashboard/master.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { startOfMonth, endOfMonth, formatISO } from 'date-fns';

type ApiRes =
  | { ok: true; data: {
      pmaYearTotal: number;        // Acumulado PMA (producción anual total)
      commissionsYearOffice: number; // Comisión anual oficina (luego de pagar corredores)
      pendingIdentify: number;     // pend. identificar total
      calendar: { date: string; count: number; titleList: string[] }[];
      production: { month: number; total?: number; goal?: number }[];
    } }
  | { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiRes>) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId) return res.status(401).json({ ok: false, error: 'No auth user' });

    const { data: profile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile || profile.role !== 'master') {
      return res.status(403).json({ ok: false, error: 'Rol no permitido' });
    }

    const year = new Date().getFullYear();

    // KPI 1: PMA anual total
    const { data: pmaRows, error: pmaErr } = await supabaseAdmin
      .from('production_monthly')
      .select('amount')
      .eq('year', year);
    if (pmaErr) throw pmaErr;
    const pmaYearTotal = (pmaRows ?? []).reduce((acc, r: any) => acc + Number(r.amount ?? 0), 0);

    // KPI 2: Comisión anual de la oficina (sum commissions.total_amount del año)
    const { data: comRows, error: cErr } = await supabaseAdmin
      .from('commissions')
      .select('total_amount, created_at')
      .gte('created_at', `${year}-01-01`)
      .lte('created_at', `${year}-12-31`);
    if (cErr) throw cErr;
    const commissionsYearOffice = (comRows ?? []).reduce((a, r: any) => a + Number(r.total_amount ?? 0), 0);

    // KPI 3: Pendientes identificar (suma de metrics_broker último corte)
    const { data: lastFt, error: fErr } = await supabaseAdmin
      .from('fortnights').select('id').eq('status', 'closed')
      .order('end_date', { ascending: false }).limit(1).maybeSingle();
    if (fErr) throw fErr;

    let pendingIdentify = 0;
    if (lastFt?.id) {
      const { data: mets, error: mErr } = await supabaseAdmin
        .from('metrics_broker')
        .select('pending_identify')
        .eq('fortnight_id', lastFt.id);
      if (mErr) throw mErr;
      pendingIdentify = (mets ?? []).reduce((a, r: any) => a + Number(r.pending_identify ?? 0), 0);
    }

    // Mini-calendario (mes actual)
    const now = new Date();
    const t0 = formatISO(startOfMonth(now));
    const t1 = formatISO(endOfMonth(now));
    const { data: evs, error: eErr } = await supabaseAdmin
      .from('events')
      .select('date, title')
      .gte('date', t0).lte('date', t1).order('date', { ascending: true });
    if (eErr) throw eErr;

    const calendarMap = new Map<string, string[]>();
    for (const e of evs ?? []) {
      const k = e.date.slice(0, 10);
      const arr = calendarMap.get(k) ?? [];
      arr.push(e.title);
      calendarMap.set(k, arr);
    }
    const calendar = Array.from(calendarMap.entries()).map(([date, titleList]) => ({ date, count: titleList.length, titleList }));

    // Barras producción total por mes (suma todos los brokers)
    const { data: prod, error: prErr } = await supabaseAdmin
      .from('production_monthly')
      .select('month, amount, goal')
      .eq('year', year)
      .order('month', { ascending: true });
    if (prErr) throw prErr;

    const byMonth: Record<number, { total?: number; goal?: number }> = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = {};
    for (const r of prod ?? []) {
      const slot = byMonth[r.month] ?? {};
      slot.total = Number(slot.total ?? 0) + Number(r.amount ?? 0);
      if (r.goal != null) slot.goal = Number(r.goal);
      byMonth[r.month] = slot;
    }
    const production = Object.entries(byMonth).map(([m, v]) => ({ month: Number(m), ...v }));

    return res.status(200).json({ ok: true, data: { pmaYearTotal, commissionsYearOffice, pendingIdentify, calendar, production }});
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
}
