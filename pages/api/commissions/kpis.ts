// pages/api/commissions/kpis.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

type Res =
  | { ok: true; data: any }
  | { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Res>) {
  try {
    const { role = 'broker', brokerEmail, year } = (req.method === 'GET' ? req.query : req.body) as {
      role?: 'master'|'broker';
      brokerEmail?: string;
      year?: number|string;
    };

    const YEAR = Number(year) || new Date().getFullYear();

    // 1) KPIs rápidos por broker (o global si master)
    let filters: any[] = [['fortnight_id', 'not.is', null]];
    if (role === 'broker' && brokerEmail) {
      // obtener broker_id por email
      const { data: bRow } = await supabaseAdmin.from('brokers')
        .select('id').ilike('brokerEmail', String(brokerEmail)).maybeSingle();
      if (bRow?.id) {
        filters.push(['broker_id', 'eq', bRow.id]);
      }
    }

    // acumulado anual por mes (para barras dobles 2024/2025 si lo necesitas)
    const { data: monthly, error: mErr } = await supabaseAdmin
      .rpc('commissions_monthly_summary', { p_year: YEAR }); // si tienes una RPC; si no, dejamos ejemplo simple:
    // Si aún no existe RPC, ejemplo simple usando commission_details + fortnights (puede ser pesado sin índices):
    // const { data: monthly, error: mErr } = await supabaseAdmin
    //   .from('commission_details')
    //   .select('amount, commissions!inner(fortnight_id, broker_id, fortnights!inner(year, period_num, start_date))');

    if (mErr) throw mErr;

    // 2) Morosidad +60
    const { data: mb, error: merr } = await supabaseAdmin
      .from('metrics_broker')
      .select('broker_id, fortnight_id, morosity_over_60, collected_amount, pending_identify, fortnights!inner(year)')
      .eq('fortnights.year', YEAR);

    if (merr) throw merr;

    res.status(200).json({ ok: true, data: { monthly, morosity: mb || [] } });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'error' });
  }
}
