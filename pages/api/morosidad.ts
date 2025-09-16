// pages/api/morosidad.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { parsePaging } from '../../lib/pagination';

type Row = {
  id: string;
  client: string;
  policy: string;
  insurer: string;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90p: number;   // para broker puedes devolver 0 si quieres ocultarlo
};

type Res = { ok: true; items: Row[]; total: number } | { ok: false; error: string };

async function getProfile(email: string) {
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
  try { profile = await getProfile(email); }
  catch { return res.status(403).json({ ok: false, error: 'perfil no encontrado' }); }

  const { from, to, q, me } = parsePaging(req);

  // Base: morosidad_imp (ajusta al nombre de tu tabla/vista)
  let qb = supabaseAdmin
    .from('morosidad_imp')
    .select('id, client, policy, insurer, current, d1_30, d31_60, d61_90, d90p, broker_email', { count: 'exact' })
    .order('client', { ascending: true });

  // Filtro de texto
  if (q) qb = qb.or(`client.ilike.%${q}%,policy.ilike.%${q}%`);

  // Visibilidad broker
  const onlyMine = me || profile?.role === 'broker';
  if (onlyMine) qb = qb.eq('broker_email', email);

  qb = qb.range(from, to);

  const { data, error, count } = await qb;
  if (error) return res.status(500).json({ ok: false, error: error.message });

  // Opcional: ocultar +90 para broker
  const items = (data ?? []).map((r: any) => {
    if (onlyMine) return { ...r, d90p: r.d90p ?? 0 };
    return r;
  });

  // Elimina broker_email del payload
  (items as any).forEach((r: any) => delete r.broker_email);

  res.status(200).json({ ok: true, items: items as Row[], total: count ?? 0 });
}
