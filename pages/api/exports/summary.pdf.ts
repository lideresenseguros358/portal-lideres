import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import  PDFDocument from 'pdfkit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fortnight_id, broker_id } = req.query as any;
  if (!fortnight_id) return res.status(400).send('faltan params');

  const { data, error } = await supabaseAdmin
    .rpc('commissions_neta_summary', { p_fortnight: fortnight_id, p_broker: broker_id ?? null });
  if (error) return res.status(500).send(error.message);

  const doc = new PDFDocument({ margin: 36 });
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','attachment; filename="resumen_quincena.pdf"');
  doc.pipe(res);

  doc.fontSize(16).text('Resumen de Comisiones por Quincena', { underline: true });
  doc.moveDown();

  const rows = data ?? [];
  rows.forEach((r:any) => {
    doc.fontSize(11).text(`${r.fullName} <${r.brokerEmail}>`);
    doc.text(`Bruta: ${r.gross_amount?.toFixed(2)} | ASSA: ${r.assa_amount?.toFixed(2)} | Desc: ${r.discounts?.toFixed(2)} | Neta: ${r.net_amount?.toFixed(2)}`);
    doc.moveDown(0.6);
  });

  doc.end();
}
