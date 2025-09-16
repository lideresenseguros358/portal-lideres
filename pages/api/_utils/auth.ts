// /pages/api/_utils/auth.ts
import type { NextApiRequest } from 'next';
import { createClient } from '@supabase/supabase-js';

/** Datos mínimos que exponemos a los endpoints */
export type AuthedUser = {
  id: string;
  email?: string;
  role?: 'master' | 'broker';
  broker_id?: string | null;
};

/** Lee el Bearer, valida el token y trae perfil (role, broker_id) */
export async function getUserFromAuthHeader(req: NextApiRequest): Promise<AuthedUser | null> {
  const authHeader = (req.headers.authorization || '').trim();
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(url, service, { auth: { persistSession: false } });

  // 1) Valida token
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return null;

  const uid = userData.user.id;

  // 2) Lee perfil (role, broker_id)
  const { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('role, broker_id, email')
    .eq('id', uid)
    .maybeSingle();

  if (pErr) return { id: uid, email: userData.user.email ?? undefined };

  return {
    id: uid,
    email: profile?.email ?? userData.user.email ?? undefined,
    role: profile?.role as 'master' | 'broker' | undefined,
    broker_id: profile?.broker_id ?? null,
  };
}

/** Exige usuario autenticado; si no, lanza 401 */
export async function requireUser(req: NextApiRequest): Promise<AuthedUser> {
  const u = await getUserFromAuthHeader(req);
  if (!u) {
    const err: any = new Error('No auth token');
    err.statusCode = 401;
    throw err;
  }
  return u;
}

/** Exige role master; si no, 403 */
export async function requireMaster(req: NextApiRequest): Promise<AuthedUser> {
  const u = await requireUser(req);
  if (u.role !== 'master') {
    const err: any = new Error('Rol no permitido');
    err.statusCode = 403;
    throw err;
  }
  return u;
}

/** (opcional) Exige role broker; útil en endpoints de broker */
export async function requireBroker(req: NextApiRequest): Promise<AuthedUser> {
  const u = await requireUser(req);
  if (u.role !== 'broker') {
    const err: any = new Error('Rol no permitido');
    err.statusCode = 403;
    throw err;
  }
  return u;
}



