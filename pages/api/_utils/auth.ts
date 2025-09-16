// /pages/api/_utils/auth.ts
import type { NextApiRequest } from 'next';
import { createClient } from '@supabase/supabase-js';

export type AuthedUser = {
  id: string;
  email?: string;
  role?: 'master' | 'broker';
  broker_id?: string | null;
};

export async function getUserFromAuthHeader(req: NextApiRequest): Promise<AuthedUser | null> {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';

    if (!token) return null;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // OJO: service-role para validar JWT
    );

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return null;

    const uid = userData.user.id;

    const { data: profile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('role, broker_id')
      .eq('id', uid)
      .maybeSingle();

    if (pErr) return { id: uid };

    return {
      id: uid,
      email: userData.user.email ?? undefined,
      role: (profile?.role as any) ?? undefined,
      broker_id: profile?.broker_id ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(req: NextApiRequest): Promise<AuthedUser> {
  const u = await getUserFromAuthHeader(req);
  if (!u) {
    const err: any = new Error('No auth user');
    err.status = 401;
    throw err;
  }
  return u;
}

export function requireRole(u: AuthedUser, roles: ('master'|'broker')[]) {
  if (!u.role || !roles.includes(u.role)) {
    const err: any = new Error('Rol no permitido');
    err.status = 403;
    throw err;
  }
}

