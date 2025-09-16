// /pages/api/admin/requests/rejects.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase-client';
import { requireMaster } from '../../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  try {
    await requireMaster(req);

    const { request_id } = (req.body ?? {}) as { request_id?: string };
    if (!request_id) return res.status(400).json({ ok: false, error: 'Falta request_id' });

    const { error } = await supabaseAdmin
      .from('signup_requests')
      .update({ status: 'rejected', decided_at: new Date().toISOString() })
      .eq('id', request_id);

    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(err?.statusCode ?? 500).json({ ok: false, error: err?.message ?? 'Error' });
  }
}
