// /pages/api/uploads.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { uploadToDrive } from '../../lib/drive';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fileBase64, name, mimeType, folderId } = req.body as {
    fileBase64: string; name: string; mimeType: string; folderId?: string;
  };
  if (!fileBase64 || !name || !mimeType) {
    return res.status(400).json({ ok: false, error: 'Faltan datos' });
  }
  const buf = Buffer.from(fileBase64.replace(/^data:.*;base64,/, ''), 'base64');
  const link = await uploadToDrive(buf, name, mimeType, (folderId || process.env.DRIVE_FOLDER_ID) as string);
  res.status(200).json({ ok: true, link });
}
