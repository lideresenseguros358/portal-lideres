// /pages/api/update-password.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  const { newPassword } = req.body ?? {};
  if (!newPassword) return res.status(400).json({ ok: false, error: 'Falta contraseña' });

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.status(200).json({ ok: true });
}
