// /pages/api/imports/aseguradoras.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../../../lib/supabase';
import { ocrImageFromBase64, ocrPdfFromBase64 } from '../../../lib/vision';

type Res =
  | { ok: true; inserted?: number; reportId?: string; ocrText?: string }
  | { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Res>) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    // payload esperado:
    // { insurer_id, fortnight_id, mime, fileBase64, broker_id? }
    const { insurer_id, fortnight_id, mime, fileBase64, broker_id } = req.body as {
      insurer_id: string;
      fortnight_id: string;
      mime: string;              // 'text/csv' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' | 'application/pdf' | 'image/png' | 'image/jpeg' ...
      fileBase64: string;        // puede venir con 'data:...;base64,'
      broker_id?: string | null;
    };

    if (!insurer_id || !fortnight_id || !mime || !fileBase64) {
      return res.status(400).json({ ok: false, error: 'Faltan datos' });
    }

    const b64 = fileBase64.replace(/^data:[^;]+;base64,/, '');

    // PDFs / Imágenes => OCR con Cloud Vision
    if (mime === 'application/pdf' || mime.startsWith('image/')) {
      const text =
        mime === 'application/pdf'
          ? await ocrPdfFromBase64(b64)
          : await ocrImageFromBase64(b64);

      // Guarda un registro del reporte con el texto OCR (útil para auditoría / normalizadores)
      const { data: rep, error: repErr } = await supabaseAdmin
        .from('reports')
        .insert({
          insurer_id,
          fortnight_id,
          broker_id: broker_id ?? null,
          ocr_text: text,
          storage_url: null,
          total_amount: null,
          meta: { mime, via: 'vision' },
        })
        .select('id')
        .single();

      if (repErr) throw repErr;

      return res.json({ ok: true, reportId: rep.id, ocrText: text });
    }

    // ===== CSV / XLSX =====
    let rows: any[] = [];
    if (mime === 'text/csv') {
      const csv = Buffer.from(b64, 'base64').toString('utf8');
      rows = Papa.parse(csv, { header: true }).data as any[];
    } else {
      // XLSX (xlsx Office Open XML)
      const buf = Buffer.from(b64, 'base64');
      const wb = XLSX.read(buf, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws);
    }

    // Aquí no “normalizamos” aún (porque cada aseguradora tiene sus headers);
    // solo dejamos una inserción ejemplo en commission_details:
    let count = 0;
    for (const r of rows) {
      // Ajusta a tus headers reales por aseguradora en el normalizador
      const policy_no =
        r['Poliza'] || r['Póliza'] || r['policy'] || r['policy_number'] || r['Policy #'] || '';
      const insured_name = r['Asegurado'] || r['insured'] || r['cliente'] || '';
      const insurer_name = r['Aseguradora'] || r['insurer'] || '';
      const amount = Number(r['Comision'] || r['commission'] || r['monto'] || '0');

      if (!policy_no && !amount) continue;

      const { error } = await supabaseAdmin.from('commission_details').insert({
        policy_no,
        insured_name,
        insurer_name,
        amount,
        insurer_id,
        fortnight_id,
        broker_id: broker_id ?? null,
        source: 'import',
      });

      if (!error) count++;
    }

    return res.json({ ok: true, inserted: count });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Error' });
  }
}

