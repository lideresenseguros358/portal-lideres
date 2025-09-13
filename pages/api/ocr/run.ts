import type { NextApiRequest, NextApiResponse } from 'next';
import { visionClient } from '../../../lib/gcloud';
import { supabaseAdmin } from '../../../lib/supabase';
const supabase = supabaseAdmin;


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { gsUri, brokerId, reportTotal, meta } = req.body as {
      gsUri: string; brokerId?: string; reportTotal?: number; meta?: any;
    };
    if (!gsUri?.startsWith('gs://')) return res.status(400).json({ error: 'gsUri inválido' });

    // OCR: funciona con imagen o PDF (auto-detecta)
    const [result] = await visionClient.documentTextDetection(gsUri);
    const text = result.fullTextAnnotation?.text ?? '';

    // Guarda en tu tabla 'reports' (asumiendo columnas: id, broker_id, gs_uri, ocr_text, total_amount, meta)
    const { data, error } = await supabase
      .from('reports')
      .insert({
        broker_id: brokerId ?? null,
        gs_uri: gsUri,
        ocr_text: text,
        total_amount: reportTotal ?? null,
        meta: meta ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ ok: true, report: data });
  } catch (e:any) {
    res.status(500).json({ error: e.message });
  }
}
