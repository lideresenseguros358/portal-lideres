// /pages/api/logout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { supabase } from '../../lib/supabase';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  await supabase.auth.signOut();
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 };
  res.setHeader('Set-Cookie', [
    serialize('portal_session', '', opts),
    serialize('portal_expires', '', opts),
  ]);
  res.status(200).json({ ok: true });
}
