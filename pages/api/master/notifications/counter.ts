// /pages/api/notifications/counter.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ok, fail } from '../../_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // TODO: contar no leídas
    ok(res, { unread: 0 });
  } catch (e: any) {
    fail(res, e?.message || 'Error counter');
  }
}
