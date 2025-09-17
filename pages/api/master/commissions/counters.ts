// /pages/api/master/commissions/counters.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ok, fail } from '../../_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // TODO: calcula pendientes reales
    ok(res, { pending_requests: 0, pending_identify: 0 });
  } catch (e: any) {
    fail(res, e?.message || 'Error counters');
  }
}
