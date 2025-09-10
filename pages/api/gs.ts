// /pages/api/gs.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const API = process.env.GSHEET_API_URL as string;
const TOKEN = process.env.GSHEET_API_TOKEN as string;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { action = 'list', table = '' } = req.query as { action?: string; table?: string };
    const url = `${API}?action=${encodeURIComponent(action)}&table=${encodeURIComponent(table)}`;

    const r = await fetch(url, {
      method: 'GET',
      headers: { 'x-portal-token': TOKEN },
      cache: 'no-store',
    });

    const txt = await r.text();

    // Intentar JSON, si no, reenviar texto (útil para depurar HTML de Drive)
    try {
      const json = JSON.parse(txt) as unknown;
      return res.status(r.status).json(json);
    } catch {
      return res.status(r.status).send(txt);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Proxy error';
    return res.status(500).json({ error: msg });
  }
}
