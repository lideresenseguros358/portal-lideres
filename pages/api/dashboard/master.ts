// /pages/api/dashboard/masters.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { requireUser } from '../_utils/auth';
import { startOfMonth, endOfMonth, formatISO } from 'date-fns';

type ApiRes =
  | { ok: true; data: any }
  | { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiRes>) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    if (user.role !== 'master') return res.status(403).json({ ok: false, error: 'Rol no permitido' });

    const year = new Date().getFullYear();

    // KPI 1: PMA anual (producción acumulada)
    const { data: prod, error: pErr } = await supabaseAdmin
      .from('production_monthly')
      .select('amount, month, goal')
      .eq('year', year)
      .order('month', { ascending: true });

    if (pErr) throw pErr;

    const pmaYearTotal = (prod || []).reduce((a: number, r: any) => a + Number(r.amount ?? 0), 0);

    // KPI 2: Comisión anual oficina (post-descuentos)
    const { data: comm, error: cErr } = await supabaseAdmin
      .from('commissions')
      .select('total_amount_net');

    if (cErr) throw cErr;
    const commissionsYearOffice = (comm || []).reduce((a: number, r: any) => a + Number(r.total_amount_net ?? 0), 0);

    // KPI 3: Pendientes de identificar (última quincena cerrada)
    const { data: lastFt, error: fErr } = await supabaseAdmin
      .from('fortnights')
      .select('id')
      .eq('status', 'closed')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    let pendingIdentify = 0;
    if (lastFt?.id) {
      const { data: mets, error: mErr } = await supabaseAdmin
        .from('metrics_broker')
        .select('pending_identify')
        .eq('fortnight_id', lastFt.id);

      if (mErr) throw mErr;
      pendingIdentify = (mets || []).reduce((a, r: any) => a + Number(r.pending_identify ?? 0), 0);
    }

    // Mini calendario (eventos del mes actual)
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

    const calendar = (evs || []).map((r) => ({ date: r.date, title: r.title }));

    // Serie de producción para las barras (mes 1..12)
    const byMonth: Record<number, { amount: number; goal: number }> = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = { amount: 0, goal: 0 };
    for (const r of prod || []) {
      const m = Number(r.month ?? 0);
      if (m >= 1 && m <= 12) {
        byMonth[m].amount += Number(r.amount ?? 0);
        byMonth[m].goal += Number(r.goal ?? 0);
      }
    }
    const production = Object.entries(byMonth).map(([k, v]) => ({ month: Number(k), ...v }));

    return res.status(200).json({
      ok: true,
      data: { pmaYearTotal, commissionsYearOffice, pendingIdentify, calendar, production },
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ ok: false, error: String(err?.message || err) });
  }
}
