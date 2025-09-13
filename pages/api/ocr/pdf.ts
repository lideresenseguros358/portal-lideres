// /pages/api/ocr/pdf.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ocrPdfViaGcs } from '../../../lib/vision-pdf';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { fileBase64 } = req.body as { fileBase64: string };

  const buf = Buffer.from(fileBase64.replace(/^data:.*;base64,/, ''), 'base64');
  const text = await ocrPdfViaGcs(buf, process.env.GCS_BUCKET!);
  res.json({ ok: true, text });
}
