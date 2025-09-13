import type { NextApiRequest, NextApiResponse } from 'next';
import { storage, GC_BUCKET } from '../../../lib/gcloud';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!GC_BUCKET) return res.status(500).json({ error: 'GC_BUCKET no configurado' });

  const { fileName, contentType } = req.body as { fileName: string; contentType: string };
  const file = storage.bucket(GC_BUCKET).file(`reports/${Date.now()}_${fileName}`);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 10 * 60 * 1000,
    contentType,
  });

  res.json({ ok: true, uploadUrl: url, gsUri: `gs://${GC_BUCKET}/${file.name}` });
}

