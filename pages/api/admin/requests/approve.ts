// /pages/api/admin/requests/approve.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase-client';
import { requireMaster } from '../../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  try {
    await requireMaster(req);

    const { request_id, make_master } = (req.body ?? {}) as { request_id?: string; make_master?: boolean };
    if (!request_id) return res.status(400).json({ ok: false, error: 'Falta request_id' });

    // 1) Cargar solicitud
    const { data: reqRow, error: rErr } = await supabaseAdmin
      .from('signup_requests')
      .select('*')
      .eq('id', request_id)
      .single();
    if (rErr || !reqRow) return res.status(404).json({ ok: false, error: rErr?.message ?? 'Solicitud no encontrada' });
    if (reqRow.status !== 'pending') return res.status(409).json({ ok: false, error: 'No está pendiente' });

    const email: string = String(reqRow.email).toLowerCase();
    const password: string = reqRow.raw_password ?? 'broker123';
    const role: 'master' | 'broker' = make_master ? 'master' : (reqRow.role ?? 'broker');

    // 2) Crear usuario
    const { data: uData, error: uErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: reqRow.fullname ?? reqRow.name ?? '' },
      app_metadata: { role },
    });
    if (uErr || !uData?.user) return res.status(500).json({ ok: false, error: uErr?.message ?? 'No se pudo crear usuario' });

    const userId = uData.user.id;

    // 3) Upsert en brokers (si aplica)
    const brokerPayload: any = {
      id: reqRow.broker_id ?? userId,
      email,
      fullName: reqRow.fullname ?? reqRow.name ?? '',
      phone: reqRow.phone ?? null,
      bank_account_no: reqRow.bank_account_no ?? null,
      bank_id: reqRow.bank_id ?? null,
      beneficiary_name: reqRow.beneficiary_name ?? null,
      beneficiary_id: reqRow.beneficiary_id ?? null,
      assa_code: reqRow.assa_code ?? null,
      default_percent: reqRow.default_percent ?? 0,
      active: true,
      app_user_id: userId,
    };
    await supabaseAdmin.from('brokers').upsert(brokerPayload, { onConflict: 'id' });

    // 4) Marcar solicitud como aprobada
    const { error: updErr } = await supabaseAdmin
      .from('signup_requests')
      .update({ status: 'approved', decided_at: new Date().toISOString() })
      .eq('id', request_id);
    if (updErr) return res.status(500).json({ ok: false, error: updErr.message });

    res.status(200).json({ ok: true, user_id: userId });
  } catch (err: any) {
    res.status(err?.statusCode ?? 500).json({ ok: false, error: err?.message ?? 'Error' });
  }
}
