// /page// /pages/api/_utils.ts
import type { NextApiResponse } from 'next';

export function ok(res: NextApiResponse, data: any, status = 200) {
  res.status(status).json({ ok: true, data });
}
export function fail(res: NextApiResponse, message: string, status = 400) {
  res.status(status).json({ ok: false, error: message });
}
