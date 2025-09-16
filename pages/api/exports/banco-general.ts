// /pages/api/exports/banco-general.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

function filename(periodLabel: string) {
  return `banco_general_${periodLabel}.csv`;
}
function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/["\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Method not allowed' });

  try {
    const { fortnight_id } = req.query as { fortnight_id?: string };
    if (!fortnight_id) return res.status(400).json({ ok:false, error:'fortnight_id requerido' });

    // 1) Quincena (para nombre/label)
    const { data: f, error: fErr } = await supabaseAdmin
      .from('fortnights')
      .select('id, year, period_num, start_date, end_date')
      .eq('id', fortnight_id).maybeSingle();
    if (fErr) throw fErr;
    if (!f) return res.status(404).json({ ok:false, error:'Quincena no encontrada' });

    const periodLabel = `${f.year}-${String(f.period_num).padStart(2,'0')}`;

    // 2) Sumar comisiones por broker en la quincena
    const { data: commDetails, error: cdErr } = await supabaseAdmin
      .from('commission_details')
      .select(`
        broker_id,
        amount,
        commissions!inner(id, fortnight_id)
      `)
      .eq('commissions.fortnight_id', fortnight_id);
    if (cdErr) throw cdErr;

    // 3) Traer descuentos (advance_movements) vinculados a esta quincena
    const { data: discounts, error: dErr } = await supabaseAdmin
      .from('advance_movements')
      .select(`
        amount,
        kind,
        created_at,
        broker_advances!inner(broker_id),
        fortnight_id
      `)
      .eq('kind', 'discount')
      .eq('fortnight_id', fortnight_id);
    if (dErr) throw dErr;

    // 4) Agregar por broker (comisiones - descuentos)
    const sumByBroker = new Map<string, number>();
    for (const r of (commDetails ?? [])) {
      const bid = r.broker_id as string;
      const prev = sumByBroker.get(bid) ?? 0;
      sumByBroker.set(bid, prev + Number(r.amount || 0));
    }
    for (const mv of (discounts ?? [])) {
      const bid = (mv as any).broker_advances?.broker_id as string | undefined;
      if (!bid) continue;
      const prev = sumByBroker.get(bid) ?? 0;
      sumByBroker.set(bid, prev - Number((mv as any).amount || 0)); // descuento resta
    }

    // 5) Enriquecer con datos bancarios de brokers (sólo los que tienen monto > 0)
    const brokerIds = [...sumByBroker.entries()].filter(([, total]) => (Number(total || 0) > 0)).map(([bid]) => bid);
    let bankRows: any[] = [];
    if (brokerIds.length) {
      const { data: bRows, error: bErr } = await supabaseAdmin
        .from('brokers')
        .select(`
          id,
          email,
          name,
          bank_account_no,
          bank_id,
          beneficiary_name,
          beneficiary_id
        `)
        .in('id', brokerIds);
      if (bErr) throw bErr;
      bankRows = bRows ?? [];
    }
    const bankById = new Map<string, any>(bankRows.map(r => [r.id, r]));

    // 6) Armar filas Banco General
    type Row = {
      cuenta: string;
      identificacion: string;
      nombre: string;
      moneda: string;
      monto: number;
      detalle: string;
      email: string;
    };

    const rows: Row[] = brokerIds.map((bid) => {
      const total = Number(sumByBroker.get(bid) || 0);
      const b = bankById.get(bid) || {};
      return {
        cuenta: String(b.bank_account_no ?? ''),
        identificacion: String(b.beneficiary_id ?? ''),
        nombre: String(b.beneficiary_name ?? b.name ?? ''),
        moneda: 'PAB',
        monto: Number(total.toFixed(2)),
        detalle: `Comisión quincena ${periodLabel}`,
        email: String(b.email ?? ''),
      };
    });

    // 7) CSV
    const headers: (keyof Row)[] = ['cuenta','identificacion','nombre','moneda','monto','detalle','email'];
    const lines: string[] = [];
    lines.push(headers.map(h => csvEscape(h)).join(','));
    for (const r of rows) lines.push(headers.map(h => csvEscape((r as any)[h])).join(','));

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename(periodLabel)}"`);
    res.status(200).send(csv);
  } catch (e: any) {
    res.status(500).json({ ok:false, error: e?.message || 'error' });
  }
}

