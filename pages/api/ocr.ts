// /pages/api/ocr.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ocrImageFromBase64, ocrPdfFromBase64 } from '../../lib/vision';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fileBase64, mime } = req.body as { fileBase64: string; mime: string };
  if (!fileBase64 || !mime) return res.status(400).json({ ok: false, error: 'Faltan datos' });

  const clean = fileBase64.replace(/^data:.*;base64,/, '');
  const text = mime === 'application/pdf'
    ? await ocrPdfFromBase64(clean)
    : await ocrImageFromBase64(clean);

  res.status(200).json({ ok: true, text });
}
