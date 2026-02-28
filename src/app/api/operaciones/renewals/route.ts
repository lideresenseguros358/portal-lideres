import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Renewals API
// ═══════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('ops_renewals')
      .select('*', { count: 'exact' })
      .order('renewal_date', { ascending: true });

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`client_name.ilike.%${search}%,policy_number.ilike.%${search}%,ticket_number.ilike.%${search}%`);

    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // Summary counts
    const { data: summary } = await supabase
      .from('ops_renewals')
      .select('status');

    const counts = {
      PENDIENTE: 0,
      EN_REVISION: 0,
      APLAZADO: 0,
      RENOVADO: 0,
      CANCELADO: 0,
    };
    summary?.forEach((r: any) => {
      if (r.status in counts) counts[r.status as keyof typeof counts]++;
    });

    return NextResponse.json({ data, total: count, counts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'update_status': {
        const { id, status, postponed_date, cancellation_reason } = body;
        const update: Record<string, any> = { status, updated_at: new Date().toISOString() };
        if (status === 'APLAZADO' && postponed_date) update.postponed_date = postponed_date;
        if (status === 'CANCELADO' && cancellation_reason) update.cancellation_reason = cancellation_reason;

        const { error } = await supabase.from('ops_renewals').update(update).eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'confirm_renewal': {
        const { id, new_start_date, new_end_date } = body;
        const { error } = await supabase.from('ops_renewals').update({
          status: 'RENOVADO',
          new_start_date,
          new_end_date,
          updated_at: new Date().toISOString(),
        }).eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
