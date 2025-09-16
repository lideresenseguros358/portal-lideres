// pages/api/insurers.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { parsePaging } from '../../lib/pagination';

type Row = { id: string; name: string; active: boolean; created_at?: string };
type Res = { ok: true; items: Row[]; total: number } | { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Res>) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { from, to, q } = parsePaging(req);

  let qb = supabaseAdmin
    .from('insurers')
    .select('id, name, active, created_at', { count: 'exact' })
    .order('name', { ascending: true });

  if (q) qb = qb.ilike('name', `%${q}%`);

  qb = qb.range(from, to);

  const { data, error, count } = await qb;
  if (error) return res.status(500).json({ ok: false, error: error.message });

  res.status(200).json({ ok: true, items: (data ?? []) as Row[], total: count ?? 0 });
}
