import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { searchParams } = new URL(request.url);
    const insurerId = searchParams.get('insurerId');
    const brokerId = searchParams.get('brokerId');

    let query = supabase
      .from('delinquency')
      .select('*');

    if (insurerId) {
      query = query.eq('insurer_id', insurerId);
    }

    if (brokerId) {
      query = query.eq('broker_id', brokerId);
    }

    query = query.gt('total_debt', 0);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const summary = {
      due_soon: 0,
      current: 0,
      bucket_1_30: 0,
      bucket_31_60: 0,
      bucket_61_90: 0,
      bucket_90_plus: 0,
      total: 0,
      count: data?.length ?? 0,
      last_import_date: null as string | null,
    };

    if (data && data.length > 0) {
      data.forEach((record: any) => {
        summary.due_soon += Number(record.due_soon) || 0;
        summary.current += Number(record.current) || 0;
        summary.bucket_1_30 += Number(record.bucket_1_30) || 0;
        summary.bucket_31_60 += Number(record.bucket_31_60) || 0;
        summary.bucket_61_90 += Number(record.bucket_61_90) || 0;
        summary.bucket_90_plus += Number(record.bucket_90_plus) || 0;
        summary.total += Number(record.total_debt) || 0;
      });

      const latest = data.reduce((latest: any, current: any) => {
        if (!latest) return current;
        return new Date(current.cutoff_date) > new Date(latest.cutoff_date) ? current : latest;
      });
      summary.last_import_date = latest?.cutoff_date ?? null;
    }

    return NextResponse.json({ data: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
