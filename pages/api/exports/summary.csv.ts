// /pages/api/exports/summary.csv.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fortnight_id, broker_id } = req.query as any;
  if (!fortnight_id) return res.status(400).send('faltan params');

  const { data, error } = await supabaseAdmin
    .rpc('commissions_meta_summary', { p_fortnight: fortnight_id, p_broker: broker_id ?? null });
  if (error) return res.status(500).send(error.message);

  const headers = ['brokerEmail','fullName','gross_amount','assa_amount','discounts','net_amount'];
  const lines: string[] = [];
  lines.push(headers.join(','));
  for (const r of (data ?? [])) lines.push(headers.map(h => JSON.stringify((r as any)[h] ?? '')).join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="resumen_quincena.csv"');
  res.send(lines.join('\n'));
}
