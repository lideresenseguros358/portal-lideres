import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../../lib/supabase-client';
import { requireMaster } from '../../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  try {
    await requireMaster(req); // <— valida Bearer + rol master

    const { request_id, make_master } = (req.body ?? {}) as { request_id: string; make_master?: boolean };

    // … tu lógica existente (no la toco) …
    // Ejemplo mínimo para que compile:
    const { data: reqRow, error: rErr } = await supabase
      .from('signup_requests')
      .select('*')
      .eq('id', request_id)
      .maybeSingle();
    if (rErr || !reqRow) return res.status(404).json({ ok: false, error: 'No está pendiente' });

    // create user
    const email = String(reqRow.email ?? '').toLowerCase();
    const password = String(reqRow.password ?? reqRow.plain_password ?? '');
    const role = make_master ? 'master' : (reqRow.role ?? 'broker');

    const { data: created, error: cErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: reqRow.full_name },
      app_metadata: { role },
    });
    if (cErr) return res.status(400).json({ ok: false, error: cErr.message });

    // marca la solicitud como aprobada (si lo haces así)
    await supabase
      .from('signup_requests')
      .update({ status: 'approved', decided_at: new Date().toISOString() })
      .eq('id', request_id);

    return res.status(200).json({ ok: true, user_id: created.user?.id });
  } catch (e: any) {
    const status = e?.statusCode ?? 500;
    return res.status(status).json({ ok: false, error: e?.message ?? 'error' });
  }
}
