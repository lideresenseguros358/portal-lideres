// /pages/api/master/morosidad/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ok, fail } from '../../_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      // TODO: devolver lista de morosidad
      return ok(res, { rows: [], total: 0 });
    }
    if (req.method === 'POST') {
      // Importar reporte de morosidad
      const { fileUrl } = req.body || {};
      if (!fileUrl) return fail(res, 'fileUrl requerido');
      // TODO: parse + upsert
      return ok(res, { processed: true });
    }
    return fail(res, 'Method not allowed', 405);
  } catch (e: any) {
    fail(res, e?.message || 'Error morosidad master');
  }
}
