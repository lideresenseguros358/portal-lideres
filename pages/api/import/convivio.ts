// pages/api/imports/convivio.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

type Res = { ok: true; inserted: number } | { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Res>) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });

  try {
    const { fortnight_id, insurer_id, csv } = req.body as {
      fortnight_id: string; insurer_id: string; csv: string;
    };
    if (!fortnight_id || !insurer_id || !csv) throw new Error('Faltan datos');

    const { data: rep, error: repErr } = await supabaseAdmin
      .from('reports')
      .insert({ storage_url: null, insurer_id, uploaded_by: null, fortnight_id })
      .select('id')
      .single();
    if (repErr) throw repErr;

    const lines = csv.trim().split(/\r?\n/);
    const headers = lines.shift()!.split(',').map(s => s.trim());

    let count = 0;
    const batch: any[] = [];

    for (const raw of lines) {
      const cols = raw.split(',').map(s => s.trim());
      const rec: Record<string,string> = {};
      headers.forEach((h, i) => { rec[h] = cols[i] ?? ''; });

      // Mapeo CONVIVIO (ajusta a tus headers reales)
      const policy_number = rec['poliza'] || rec['policy'] || rec['policy_number'];
      const amount = Number(rec['neto'] ?? rec['amount'] ?? '0');
      const brokerIdText = rec['brokerId'] || rec['broker_id'] || rec['codigo_broker'];

      // buscar broker por brokerId si viene
      let broker_id: string | null = null;
      if (brokerIdText) {
        const { data: b } = await supabaseAdmin.from('brokers')
          .select('id').eq('brokerId', brokerIdText).maybeSingle();
        broker_id = b?.id ?? null;
      }

      batch.push({
        report_id: rep.id,
        policy_number,
        client_id: null,
        insurer_id,
        broker_id,
        amount,
        currency: 'PAB',
        ocr_confidence: null,
        matched_flags: { via: 'import-convivio', id_match: !!broker_id },
        fortnight_id,
        extra_json: rec,
      });

      if (batch.length >= 1000) {
        const { error } = await supabaseAdmin.from('report_items').insert(batch);
        if (error) throw error;
        count += batch.length;
        batch.length = 0;
      }
    }
    if (batch.length) {
      const { error } = await supabaseAdmin.from('report_items').insert(batch);
      if (error) throw error;
      count += batch.length;
    }

    res.status(200).json({ ok: true, inserted: count });
  } catch (e: any) {
    res.status(500).json({ ok:false, error: e?.message || 'error' });
  }
}
