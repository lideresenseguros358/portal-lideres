// /pages/api/notifications/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ok, fail } from '../../_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // TODO: trae últimas notificaciones del usuario logueado
    ok(res, [
      // { id:'1', title:'Nueva solicitud de usuario', created_at: new Date().toISOString() }
    ]);
  } catch (e: any) {
    fail(res, e?.message || 'Error notificaciones');
  }
}
