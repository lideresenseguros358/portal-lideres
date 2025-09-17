// /pages/api/master/production/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ok, fail } from '../../_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      // Lista por corredor + historico por año
      // TODO: trae de DB
      return ok(res, {
        years: [2024, 2025],
        brokers: [
          { id: 'b1', name: 'Broker A', months: Array(12).fill(0), metaMensual: 0, metaAnual: 0 },
        ],
      });
    }
    if (req.method === 'POST') {
      // Actualizar producción de un corredor/mes
      const { brokerId, year, month, amount, metaMensual, metaAnual } = req.body || {};
      // TODO: upsert en DB
      return ok(res, { saved: true });
    }
    return fail(res, 'Method not allowed', 405);
  } catch (e: any) {
    fail(res, e?.message || 'Error producción master');
  }
}
