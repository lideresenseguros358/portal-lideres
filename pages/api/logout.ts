// /pages/api/logout.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  // Si más adelante usas cookies httpOnly, aquí las limpiarías.
  res.status(200).json({ ok: true });
}
