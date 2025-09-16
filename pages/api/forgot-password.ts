// /pages/api/forgot-password.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ ok: false, error: 'Falta email' });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/update-password`,
  });
  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.status(200).json({ ok: true });
}
