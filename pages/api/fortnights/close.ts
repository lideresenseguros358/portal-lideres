import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

type ApiRes =
  | { ok: true; message: string }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiRes>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    return res.status(401).json({ ok: false, error: 'No auth user' });
  }

  // exige rol master
  const { data: prof, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (pErr) {
    return res.status(500).json({ ok: false, error: pErr.message });
  }
  if (!prof || prof.role !== 'master') {
    return res.status(403).json({ ok: false, error: 'Rol no permitido' });
  }

  const { fortnight_id } = req.body || {};
  if (!fortnight_id) {
    return res.status(400).json({ ok: false, error: 'faltó fortnight_id' });
  }

  // 1) commissions por broker en esta quincena
  const { data: comms, error: cErr } = await supabaseAdmin
    .from('commissions')
    .select('id, broker_id, total_amount')
    .eq('fortnight_id', fortnight_id);

  if (cErr) {
    return res.status(500).json({ ok: false, error: cErr.message });
  }

  // 2) descuentos por broker (advance_movements vinculados a esta quincena)
  //    OJO: el join devuelve arreglo broker_advances:[{ broker_id }]
  const { data: moves, error: mErr } = await supabaseAdmin
    .from('advance_movements')
    .select('amount, kind, broker_advances!inner(id, broker_id)')
    .eq('fortnight_id', fortnight_id)
    .eq('kind', 'discount');

  if (mErr) {
    return res.status(500).json({ ok: false, error: mErr.message });
  }

  // 3) agregamos descuentos por broker
  const discountByBroker = new Map<string, number>();
  for (const mv of moves ?? []) {
    const bid = (mv as any)?.broker_advances?.[0]?.broker_id as string | undefined;
    if (!bid) continue;
    const prev = discountByBroker.get(bid) ?? 0;
    discountByBroker.set(bid, prev + Number((mv as any).amount ?? 0));
  }

  // 4) actualizar commissions.total_amount_net y marcar quincena cerrada
  for (const c of comms ?? []) {
    const disc = discountByBroker.get(c.broker_id) ?? 0;
    const net = Number(c.total_amount ?? 0) - disc;

    const { error: uErr } = await supabaseAdmin
      .from('commissions')
      .update({ total_amount_net: net })
      .eq('id', c.id);

    if (uErr) {
      return res.status(500).json({ ok: false, error: uErr.message });
    }
  }

  const { error: fErr } = await supabaseAdmin
    .from('fortnights')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', fortnight_id);

  if (fErr) {
    return res.status(500).json({ ok: false, error: fErr.message });
  }

  return res
    .status(200)
    .json({ ok: true, message: 'Quincena cerrada y descuentos aplicados' });
}
