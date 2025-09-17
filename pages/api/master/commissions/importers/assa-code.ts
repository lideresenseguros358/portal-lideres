// /pages/api/master/commissions/importers/assa-codes.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ok, fail } from '../../../_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

    const { fileUrl } = req.body || {}; // o manda rows ya parseadas si prefieres
    if (!fileUrl) return fail(res, 'fileUrl requerido');

    // TODO:
    // Parsear archivo (si lo manejas server-side) y actualizar mapeo de códigos ASSA -> broker/cliente

    ok(res, { processed: true });
  } catch (e: any) {
    fail(res, e?.message || 'Error importer ASSA');
  }
}
