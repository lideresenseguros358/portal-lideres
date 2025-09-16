// /pages/api/admin/requests/reject.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  const { request_id } = req.body ?? {};
  const { error } = await supabaseAdmin
    .from('signup_requests')
    .update({ status: 'rejected', decided_at: new Date().toISOString() })
    .eq('id', request_id);

  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.status(200).json({ ok: true });
}
