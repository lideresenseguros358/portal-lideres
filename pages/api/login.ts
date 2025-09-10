// /pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { gsLogin } from 'src/lib/gsheets';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Faltan credenciales' });

  const r = await gsLogin(String(email), String(password));

  if (!r.ok) {
    return res.status(r.status || 500).json({ ok: false, error: r.error || 'Login failed', raw: r.raw });
  }

  // Puedes setear cookie httpOnly si quieres; por ahora devolvemos datos para localStorage
  return res.status(200).json({
    ok: true,
    sessionId: r.sessionId,
    role: r.role,
    brokerEmail: r.brokerEmail,
  });
}
