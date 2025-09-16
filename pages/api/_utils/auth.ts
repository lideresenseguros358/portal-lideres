// /pages/api/_utils/auth.ts
import type { NextApiRequest } from 'next';
import { supabaseAdmin } from '../../../lib/supabase-client';

export type AuthedUser = {
  id: string;
  email?: string;
  role?: 'master' | 'broker';
  broker_id?: string | null;
};

export async function getUserFromAuthHeader(req: NextApiRequest): Promise<AuthedUser | null> {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';

    if (!token) return null;

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return null;

    const uid = userData.user.id;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, broker_id')
      .eq('id', uid)
      .maybeSingle();

    return {
      id: uid,
      email: userData.user.email || undefined,
      role: (profile?.role as any) || undefined,
      broker_id: profile?.broker_id ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireUser(req: NextApiRequest) {
  const u = await getUserFromAuthHeader(req);
  if (!u) {
    const e: any = new Error('No auth token');
    e.statusCode = 401;
    throw e;
  }
  return u;
}


