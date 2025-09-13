import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fortnight_id, broker_id } = req.query as { fortnight_id?: string; broker_id?: string };
  if (!fortnight_id) return res.status(400).json({ ok:false, error:'faltan params' });

  const { data, error } = await supabaseAdmin
    .rpc('commissions_neta_summary', { p_fortnight: fortnight_id, p_broker: broker_id ?? null });

  if (error) return res.status(500).json({ ok:false, error: error.message });
  res.json({ ok:true, rows: data });
}
