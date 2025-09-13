// pages/api/metrics/broker.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { brokerId } = req.query as { brokerId?: string };
  if (!brokerId) return res.status(400).json({ ok: false, error: 'Falta brokerId' });

  const { data, error } = await supabaseAdmin
    .from('metrics_broker')
    .select('*')
    .eq('broker_id', brokerId)
    .single();

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true, data });
}
