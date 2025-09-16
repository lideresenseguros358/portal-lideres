// /pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize, CookieSerializeOptions } from 'cookie';
import { supabase } from '../../lib/supabase';

type Role = 'master' | 'broker';

type ApiOk = {
  ok: true;
  sessionId: string;
  role: Role;
  brokerEmail?: string;
  expiresAt: string;
};
type ApiErr = { ok: false; error: string };

const SESSION_HOURS = Number(process.env.SESSION_HOURS || '24');
const cookieOpts: CookieSerializeOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_HOURS * 3600
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>
) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Faltan credenciales' });

  // 1) Login en Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });

  // 2) Rol desde app_metadata
  const user = data.user;
  const role = ((user?.app_metadata as any)?.role ?? 'broker') as Role;

  // 3) Asegurar perfil broker enlazado
  if (role === 'broker') {
    const byAuth = await supabase
      .from('brokers')
      .select('id,email')
      .eq('auth_user_id', user!.id)
      .maybeSingle();
    if (byAuth.error) return res.status(500).json({ ok: false, error: 'Error consultando brokers' });

    if (!byAuth.data) {
      const byEmail = await supabase
        .from('brokers')
        .select('id,email')
        .ilike('email', String(email))
        .maybeSingle();
      if (byEmail.error || !byEmail.data) {
        return res.status(403).json({ ok: false, error: 'Tu usuario no tiene perfil vinculado' });
      }
    }
  }

  // 4) Cookies de tu portal (compatibles con tu middleware actual)
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();

  res.setHeader('Set-Cookie', [
    serialize('portal_session', sessionId, cookieOpts),
    serialize('portal_expires', expiresAt, cookieOpts),
  ]);

  return res.status(200).json({
    ok: true,
    sessionId,
    role,
    brokerEmail: email.toLowerCase(),
    expiresAt
  });
}
