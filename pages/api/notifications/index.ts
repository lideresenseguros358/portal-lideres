// /pages/api/notifications/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

type ApiList =
  | { ok: true; items: any[]; unread: number }
  | { ok: false; error: string };

function lower(s?: string){ return (s ?? '').trim().toLowerCase(); }

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiList>) {
  const email = req.headers['x-email'];
  if (!email || typeof email !== 'string') return res.status(401).json({ ok: false, error: 'falta x-email' });

  // Encontrar broker/auth_user
  const byAuth = await supabase.auth.getUser();
  const authUserId = byAuth.data.user?.id ?? null;

  // Rol por app_metadata si viene con sesión; fallback por tabla brokers
  let role = (byAuth.data.user?.app_metadata as any)?.role || 'broker';
  if (!byAuth.data.user) {
    const probe = await supabase.from('brokers').select('role').ilike('email', lower(email)).maybeSingle();
    role = (probe.data?.role ?? 'broker');
  }

  // LIST
  if (req.method === 'GET') {
    const q = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    // master ve todas; broker ve las propias + 'all' (cubierto por RLS, pero filtramos si no hay sesión válida)
    // Si no hay auth.uid(), filtramos por email -> broker_id
    if (!authUserId && role !== 'master') {
      const idr = await supabase.from('brokers').select('auth_user_id').ilike('email', lower(email)).maybeSingle();
      const bid = idr.data?.auth_user_id ?? null;
      if (!bid) return res.status(403).json({ ok: false, error: 'Perfil no encontrado' });
      q.in('broker_id', [bid, null]);
    }

    const { data, error } = await q;
    if (error) return res.status(500).json({ ok: false, error: error.message });

    const unread = (data ?? []).filter(n => !n.read_at).length;
    return res.status(200).json({ ok: true, items: data ?? [], unread });
  }

  // CREATE (sólo master)
  if (req.method === 'POST') {
    if (role !== 'master') return res.status(403).json({ ok: false, error: 'Sólo master' });
    const { brokerId, audience, type, title, body, meta } = req.body ?? {};
    const { error } = await supabaseAdmin.from('notifications').insert({
      broker_id: brokerId ?? null,
      audience: audience ?? (brokerId ? 'broker' : 'all'),
      type, title, body, meta
    });
    if (error) return res.status(400).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, items: [], unread: 0 });
  }

  // PUT: marcar una como leída
  if (req.method === 'PUT') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ ok: false, error: 'falta id' });
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, items: [], unread: 0 });
  }

  // PATCH: marcar todas como leídas del usuario
  if (req.method === 'PATCH') {
    // buscar auth_user_id por email
    const idr = await supabase.from('brokers').select('auth_user_id').ilike('email', lower(email)).maybeSingle();
    const bid = idr.data?.auth_user_id ?? null;
    if (!bid) return res.status(403).json({ ok: false, error: 'Perfil no encontrado' });

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .in('broker_id', [bid, null]); // incluye 'all'
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, items: [], unread: 0 });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
