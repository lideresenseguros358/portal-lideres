// /pages/api/exports/summary.xlsx.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import * as XLSX from 'xlsx';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fortnight_id, broker_id } = req.query as any;
  if (!fortnight_id) return res.status(400).send('faltan params');

  const { data, error } = await supabaseAdmin
    .rpc('commissions_meta_summary', { p_fortnight: fortnight_id, p_broker: broker_id ?? null });
  if (error) return res.status(500).send(error.message);

  const ws = XLSX.utils.json_to_sheet(data ?? []);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="resumen_quincena.xlsx"');
  res.send(buf);
}
