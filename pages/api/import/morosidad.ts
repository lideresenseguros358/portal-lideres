// /pages/api/import/morosidad.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { file, brokerId } = req.body as { file: string; brokerId?: string }; // base64 sin encabezado data:
    if (!file) return res.status(400).json({ ok:false, error:'Falta archivo' });

    let rows: any[] = [];

    // Heurística barata para saber si es CSV
    if (/\.csv$/i.test(req.query.name as string || '')) {
      rows = Papa.parse(file, { header: true }).data as any[];
    } else {
      const wb = XLSX.read(file, { type: 'base64' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws) as any[];
    }

    for (const r of rows) {
      await supabaseAdmin.from('morosidad_import').insert({
        broker_id: brokerId ?? null,
        policy_no: r['Poliza'] ?? r['policy'] ?? r['póliza'] ?? null,
        insurer:  r['Aseguradora'] ?? r['insurer'] ?? null,
        days_overdue: Number(r['Días'] ?? r['dias'] ?? r['days'] ?? 0),
        amount: Number(r['Monto'] ?? r['monto'] ?? r['amount'] ?? 0),
        raw: r,
      });
    }

    res.json({ ok:true, count: rows.length });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e.message });
  }
}
