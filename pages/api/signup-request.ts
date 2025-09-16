// /pages/api/signup-request.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  const {
    name, email, brokerid, phone,
    birthdate, licenseno, bank_account_no, bank_id,
    beneficiary_name, beneficiary_id, assacode, defaultpercent,
    plain_password
  } = req.body ?? {};

  const e = String(email || '').trim().toLowerCase();
  if (!name || !e || !brokerid || !phone || !plain_password) {
    return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
  }

  const insertObj = {
    name, email: e, brokerid, phone,
    birthdate: birthdate || null,
    licenseno: licenseno || null,
    bank_account_no: bank_account_no || null,
    bank_id: bank_id || null,
    beneficiary_name: beneficiary_name || null,
    beneficiary_id: beneficiary_id || null,
    assacode: assacode || null,
    defaultpercent: defaultpercent ?? null,
    plain_password,
    role: 'broker'
  };

  const { error } = await supabase
    .from('signup_requests')
    .insert(insertObj);

  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.status(200).json({ ok: true });
}
