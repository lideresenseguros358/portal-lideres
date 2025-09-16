// pages/api/clients.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { parsePaging } from '../../lib/pagination';

type Row = {
  id: string;
  client_name: string;
  policy: string;
  insurer: string;
  broker_email?: string;
  created_at?: string;
};

type Res = { ok: true; items: Row[]; total: number } | { ok: false; error: string };

async function getProfileByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, role, broker_id')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Res>) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const email = (req.headers['x-email'] as string | undefined) ?? '';
  if (!email) return res.status(401).json({ ok: false, error: 'falta x-email' });

  let profile: any = null;
  try {
    profile = await getProfileByEmail(email);
  } catch {
    return res.status(403).json({ ok: false, error: 'perfil no encontrado' });
  }

  const { from, to, q, me } = parsePaging(req);

  // Query base
  let qb = supabaseAdmin
    .from('clients')
    .select('id, client_name, policy, insurer, broker_email, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  // Filtro por texto
  if (q) {
    qb = qb.or(`client_name.ilike.%${q}%,policy.ilike.%${q}%`);
  }

  // Visibilidad:
  // - Si me=1 (o si el rol es broker), filtra por broker_email = email
  if (me || profile?.role === 'broker') {
    qb = qb.eq('broker_email', email);
  }

  // Paginación
  qb = qb.range(from, to);

  const { data, error, count } = await qb;
  if (error) return res.status(500).json({ ok: false, error: error.message });

  res.status(200).json({ ok: true, items: (data ?? []) as Row[], total: count ?? 0 });
}
