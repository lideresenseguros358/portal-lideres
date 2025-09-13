// pages/api/advances/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

type Api =
  | { ok: true; items?: any[]; message?: string }
  | { ok: false; error: string };

async function getProfileByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, role, broker_id')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Api>) {
  // Nuestro login guarda portal_email/portal_role en localStorage.
  const email = req.headers['x-email'] as string | undefined;
  if (!email) return res.status(401).json({ ok: false, error: 'Falta x-email' });

  const profile = await getProfileByEmail(email);
  if (!profile) return res.status(403).json({ ok: false, error: 'Perfil no encontrado' });

  // GET: lista (master: todos; broker: sólo los suyos, con saldo)
  if (req.method === 'GET') {
    const q = supabaseAdmin
      .from('broker_advances')
      .select(`
        id, broker_id, concept, amount, created_at,
        moves:advance_movements(amount, kind)
      `);

    if (profile.role !== 'master') q.eq('broker_id', profile.broker_id);

    const { data, error } = await q;
    if (error) return res.status(500).json({ ok: false, error: error.message });

    const items = (data ?? []).map((a: any) => {
      const totalDiscount = (a?.moves ?? [])
        .filter((m: any) => m.kind === 'discount')
        .reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0);
      const saldo = Number(a.amount ?? 0) - totalDiscount;
      return { ...a, saldo, totalDiscount };
    });

    return res.status(200).json({ ok: true, items });
  }

  // POST/PUT/DELETE sólo master
  if (profile.role !== 'master') {
    return res.status(403).json({ ok: false, error: 'Sólo master' });
  }

  if (req.method === 'POST') {
    const { broker_id, concept, amount } = req.body || {};
    if (!broker_id || !amount) {
      return res.status(400).json({ ok: false, error: 'Faltan campos' });
    }
    const { error } = await supabaseAdmin
      .from('broker_advances')
      .insert([{ broker_id, concept, amount }]);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, message: 'Adelanto creado' });
  }

  if (req.method === 'PUT') {
    const { id, concept, amount } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'Falta id' });
    const { error } = await supabaseAdmin
      .from('broker_advances')
      .update({ concept, amount })
      .eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, message: 'Adelanto actualizado' });
  }

  if (req.method === 'DELETE') {
    const id = (req.query.id as string) || (req.body?.id as string);
    if (!id) return res.status(400).json({ ok: false, error: 'Falta id' });
    const { error } = await supabaseAdmin.from('broker_advances').delete().eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, message: 'Adelanto eliminado' });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
