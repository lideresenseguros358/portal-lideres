import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) return res.status(401).json({ ok:false, error:'No auth user' });

  const { data: prof } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (prof?.role !== 'master') return res.status(403).json({ ok:false, error:'Rol no permitido' });

  const { advance_id, amount, kind, note, fortnight_id } = req.body || {};
  if (!advance_id || typeof amount !== 'number' || !kind) {
    return res.status(400).json({ ok:false, error:'Faltan campos' });
  }

  const { error } = await supabaseAdmin.from('advance_movements').insert([{
    advance_id, amount, kind, note, fortnight_id: fortnight_id ?? null
  }]);
  if (error) return res.status(500).json({ ok:false, error:error.message });

  return res.status(200).json({ ok:true });
}
