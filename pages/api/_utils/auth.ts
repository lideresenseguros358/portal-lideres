// /pages/api/_utils/auth.ts
import type { NextApiRequest } from 'next';
import { supabaseAdmin } from '../../../lib/supabase-client';

export type AuthedUser = {
  id: string;
  email?: string;
  role?: 'master' | 'broker';
  broker_id?: string | null;
};

/** Decodifica y valida el Bearer; devuelve perfil (role, broker_id). */
export async function getUserFromAuthHeader(req: NextApiRequest): Promise<AuthedUser | null> {
  try {
    const auth = req.headers.authorization ?? '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    if (!token) return null;

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return null;

    const uid = userData.user.id;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, broker_id')
      .eq('id', uid)
      .maybeSingle();

    return { id: uid, email: userData.user.email ?? undefined, role: profile?.role as any, broker_id: profile?.broker_id ?? null };
  } catch {
    return null;
  }
}

export async function requireMaster(req: NextApiRequest): Promise<AuthedUser> {
  const u = await getUserFromAuthHeader(req);
  if (!u || u.role !== 'master') {
    const err: any = new Error('No autorizado');
    err.statusCode = 403;
    throw err;
  }
  return u;
}

