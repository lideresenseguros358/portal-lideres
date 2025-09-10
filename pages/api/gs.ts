// pages/api/gs.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const API = process.env.GSHEET_API_URL!;
const TOKEN = process.env.GSHEET_API_TOKEN!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { action = 'list', table = '' } = req.query;
    const url = `${API}?action=${encodeURIComponent(action as string)}&table=${encodeURIComponent(table as string)}`;

    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'x-portal-token': TOKEN
      }
    });

    const txt = await r.text();

    // Apps Script debe devolver JSON; si no, 401/HTML típico de Drive
    try {
      const json = JSON.parse(txt);
      return res.status(r.status).json(json);
    } catch {
      return res.status(r.status).send(txt);
    }
  } catch (e:any) {
    return res.status(500).json({ error: e.message || 'Proxy error' });
  }
}
