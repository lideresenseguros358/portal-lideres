import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';
import { requireMaster } from '../../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  try {
    await requireMaster(req);

    const { request_id } = (req.body ?? {}) as { request_id: string };

    const { error } = await supabaseAdmin
      .from('signup_requests')
      .update({ status: 'rejected', decided_at: new Date().toISOString() })
      .eq('id', request_id);

    if (error) return res.status(400).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    const status = e?.statusCode ?? 500;
    return res.status(status).json({ ok: false, error: e?.message ?? 'error' });
  }
}
