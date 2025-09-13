import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });

  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) return res.status(401).json({ ok:false, error:'No auth user' });

  const { data: prof } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (prof?.role !== 'master') return res.status(403).json({ ok:false, error:'Rol no permitido' });

  const { id, broker_id, reason, amount, currency } = req.body || {};
  if (!broker_id || !reason || typeof amount !== 'number') {
    return res.status(400).json({ ok:false, error:'Faltan campos' });
  }

  const payload: any = { broker_id, reason, amount, currency: currency || 'PAB', status: 'open' };
  let q = supabaseAdmin.from('broker_advances').upsert(id ? [{ id, ...payload }] : [payload]).select('id').single();
  const { data, error } = await q;
  if (error) return res.status(500).json({ ok:false, error:error.message });

  return res.status(200).json({ ok:true, id: data.id });
}
