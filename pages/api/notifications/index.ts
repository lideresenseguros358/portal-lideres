import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

type Api = { ok: true; items?: any[]; unread?: number } | { ok: false; error: string };

async function getProfile(email: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles').select('id, role, broker_id').eq('email', email).maybeSingle();
  if (error) throw error;
  return data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Api>) {
  const email = req.headers['x-email'] as string | undefined;
  if (!email) return res.status(401).json({ ok: false, error: 'Falta x-email' });

  const p = await getProfile(email);
  if (!p) return res.status(403).json({ ok: false, error: 'Perfil no encontrado' });

  if (req.method === 'GET') {
    // lista + contador no leídas
    const q = supabaseAdmin.from('notifications').select('*').order('created_at', { ascending: false });
    if (p.role !== 'master') q.eq('broker_id', p.broker_id);
    const { data, error } = await q;
    if (error) return res.status(500).json({ ok: false, error: error.message });

    const unread = (data ?? []).filter((n: any) => !n.read_at).length;
    return res.status(200).json({ ok: true, items: data ?? [], unread });
  }

  if (req.method === 'POST') {
    if (p.role !== 'master') return res.status(403).json({ ok: false, error: 'Sólo master' });
    const { broker_id, title, body } = req.body || {};
    const { error } = await supabaseAdmin.from('notifications').insert([{ broker_id, title, body }]);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PUT') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'Falta id' });
    const { error } = await supabaseAdmin.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
