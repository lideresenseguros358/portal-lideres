// /pages/api/admin/requests/approve.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  const { request_id, make_master } = req.body ?? {};

  // 1) Carga la solicitud
  const { data: reqRow, error: rErr } = await supabaseAdmin
    .from('signup_requests').select('*').eq('id', request_id).single();
  if (rErr) return res.status(400).json({ ok: false, error: rErr.message });
  if (reqRow.status !== 'pending') return res.status(409).json({ ok: false, error: 'No está pendiente' });

  const email = String(reqRow.email).toLowerCase();
  const name  = reqRow.name;
  const password = reqRow.plain_password;
  const role = make_master ? 'master' : (reqRow.role || 'broker');

  // 2) Crea usuario en Auth con la contraseña elegida por el corredor
  const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { full_name: name },
    app_metadata: { role }
  });
  if (cErr) return res.status(400).json({ ok: false, error: cErr.message });

  // 3) Upsert en brokers con TODA la info
  const upsertObj = {
    email,
    name,
    auth_user_id: created.user.id,
    role,
    active: true,

    brokerid: reqRow.brokerid,
    phone: reqRow.phone,
    birthdate: reqRow.birthdate,
    licenseno: reqRow.licenseno,
    bank_account_no: reqRow.bank_account_no,
    bank_id: reqRow.bank_id,
    beneficiary_name: reqRow.beneficiary_name,
    beneficiary_id: reqRow.beneficiary_id,
    assacode: reqRow.assacode,
    defaultpercent: reqRow.defaultpercent,
    plain_password: password
  };

  const { error: bErr } = await supabaseAdmin
    .from('brokers')
    .upsert(upsertObj, { onConflict: 'email' });
  if (bErr) return res.status(400).json({ ok: false, error: bErr.message });

  // 4) Marca la solicitud como aprobada
  await supabaseAdmin
    .from('signup_requests')
    .update({ status: 'approved', decided_at: new Date().toISOString() })
    .eq('id', request_id);

  res.status(200).json({ ok: true });
}
