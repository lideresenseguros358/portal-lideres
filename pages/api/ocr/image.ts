// /pages/api/ocr/image.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ocrImageFromBase64 } from '../../../lib/vision';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fileBase64 } = req.body as { fileBase64: string };
  const text = await ocrImageFromBase64(fileBase64.replace(/^data:.*;base64,/, ''));
  res.json({ ok: true, text });
}
