// /pages/api/admin/requests/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../../lib/supabase';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const { data, error } = await supabase
    .from('signup_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.status(200).json({ ok: true, data });
}
