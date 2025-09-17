// /pages/api/master/commissions/importers/insurer.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ok, fail } from '../../../_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

    const { insurer, amount, fileUrl } = req.body || {};
    if (!insurer) return fail(res, 'insurer requerido');
    if (typeof amount !== 'number') return fail(res, 'amount numérico requerido');

    // TODO:
    // 1) Registrar import en tabla quincena_detalle (o similar) con insurer, amount y fileUrl
    // 2) Recalcular totales de oficina
    // 3) Responder números actualizados para refrescar pantalla

    ok(res, { insurer, amount, fileUrl, saved: true });
  } catch (e: any) {
    fail(res, e?.message || 'Error importer aseguradoras');
  }
}
