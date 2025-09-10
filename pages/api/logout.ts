// pages/api/logout.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Set-Cookie', [
    `portal_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  ]);
  res.status(200).json({ ok:true });
}
