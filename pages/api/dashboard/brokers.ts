// /pages/api/dashboard/brokers.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase-client';
import { requireUser } from '../_utils/auth';

type ApiRes =
  | { ok: true; data: any }
  | { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiRes>) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    if (user.role !== 'broker') return res.status(403).json({ ok: false, error: 'Rol no permitido' });

    const brokerId = user.broker_id!;
    // KPIs del broker (ajusta a tus tablas reales)
    const { data: lastFt } = await supabaseAdmin
      .from('fortnights')
      .select('id')
      .eq('status', 'closed')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    let lastFortnightAmount = 0;
    if (lastFt?.id) {
      const { data } = await supabaseAdmin
        .from('commissions')
        .select('total_amount_net')
        .eq('fortnight_id', lastFt.id)
        .eq('broker_id', brokerId);

      lastFortnightAmount = (data || []).reduce((a: number, r: any) => a + Number(r.total_amount_net ?? 0), 0);
    }

    const { data: mets } = await supabaseAdmin
      .from('metrics_broker')
      .select('morosidad_over60, convivo_goal, convivo_split, assa_goal, assa_current')
      .eq('broker_id', brokerId)
      .order('fortnight_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      lastFortnightAmount,
      morosidadOver60: Number(mets?.morosidad_over60 ?? 0),
      convivo: { goal: Number(mets?.convivo_goal ?? 0), split: mets?.convivo_split ?? [] },
      assa: { goal: Number(mets?.assa_goal ?? 0), current: Number(mets?.assa_current ?? 0) },
      calendar: [],
      production: [],
    };

    return res.status(200).json({ ok: true, data: payload });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ ok: false, error: String(err?.message || err) });
  }
}


