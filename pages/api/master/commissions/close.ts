// pages/api/master/commissions/close.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';
import { requireUser } from '../../_utils/auth'; // usa tu helper existente

type ApiRes = { ok: true; message: string } | { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiRes>) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    if (user.role !== 'master') return res.status(403).json({ ok: false, error: 'Rol no permitido' });

    // 1) última quincena abierta
    const { data: ft, error: fErr } = await supabaseAdmin
      .from('fortnights').select('id').eq('status','open').order('id', { ascending: false }).limit(1).maybeSingle();
    if (fErr) throw fErr;
    const fortnight_id = ft?.id;
    if (!fortnight_id) return res.status(400).json({ ok: false, error: 'No hay quincena abierta' });

    // 2) descuentos por broker (adelantos vinculados a esta quincena)
    const { data: moves, error: mErr } = await supabaseAdmin
      .from('advance_movements')
      .select('amount, kind, broker_advances!inner(id, broker_id)')
      .eq('fortnight_id', fortnight_id);
    if (mErr) throw mErr;

    const discountByBroker = new Map<string, number>();
    for (const mv of (moves ?? [])) {
      const bid = (mv as any).broker_advances?.[0]?.broker_id as string | undefined;
      if (!bid) continue;
      const prev = discountByBroker.get(bid) ?? 0;
      discountByBroker.set(bid, prev + Number(mv?.amount ?? 0));
    }

    // 3) actualizar commissions.total_amount_net y marcar quincena cerrada
    const { data: comms, error: cErr } = await supabaseAdmin
      .from('commissions')
      .select('id, broker_id, total_amount_net')
      .eq('fortnight_id', fortnight_id);
    if (cErr) throw cErr;

    for (const c of (comms ?? [])) {
      const disc = discountByBroker.get(c.broker_id) ?? 0;
      const net  = Number(c.total_amount_net ?? 0) - disc;
      const { error: uErr } = await supabaseAdmin
        .from('commissions')
        .update({ total_amount_net: net })
        .eq('id', c.id);
      if (uErr) throw uErr;
    }

    const { error: closeErr } = await supabaseAdmin
      .from('fortnights')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', fortnight_id);
    if (closeErr) throw closeErr;

    return res.status(200).json({ ok: true, message: 'Quincena cerrada y descuentos aplicados' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
