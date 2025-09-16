import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = String(req.query?.q ?? '').trim();
  const me = String(req.query?.me ?? '') === '1';
  const email = (req.headers['x-email'] as string | undefined) ?? '';

  let qb = supabaseAdmin
    .from('clients')
    .select('client_name,policy,insurer,broker_email,created_at');

  if (q) qb = qb.or(`client_name.ilike.%${q}%,policy.ilike.%${q}%`);
  if (me && email) qb = qb.eq('broker_email', email);

  const { data, error } = await qb;
  if (error) return res.status(500).send(error.message);

  const header = ['Cliente','Poliza','Aseguradora','Broker','Creado'];
  const rows = (data ?? []).map((r:any)=>[
    r.client_name, r.policy, r.insurer, r.broker_email ?? '', r.created_at ?? ''
  ]);
  const csv = [header, ...rows].map(r=>r.map(x=>`"${String(x??'').replace(/"/g,'""')}"`).join(',')).join('\n');

  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="clientes.csv"');
  res.status(200).send(csv);
}
