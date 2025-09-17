// /pages/api/master/commissions/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ok, fail } from '../../_utils';

const INSURERS = ['ASSA','PMA','MAPFRE','ACERTA']; // TODO: saca de tabla insurers

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

    // TODO: aquí van queries reales a tu DB
    const data = {
      badges: { pending_requests: 0, pending_identify: 0 },
      importers: { insurers: INSURERS },
      totals_by_insurer: INSURERS.map(n => ({ insurer: n, bruto: 0, oficina: 0 })),
      pending_identify: [],
      advances: [],
      consolidated_by_broker: [], // {corredor, bruto, descuentos, pago}
    };

    ok(res, data);
  } catch (e: any) {
    fail(res, e?.message || 'Error master commissions');
  }
}
