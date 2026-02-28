import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Urgencies API
// ═══════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let query = supabase
      .from('ops_urgencies')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`client_name.ilike.%${search}%,category.ilike.%${search}%`);

    const { data, count, error } = await query;
    if (error) throw error;

    // Summary counts
    const { data: summary } = await supabase.from('ops_urgencies').select('status, sla_deadline');
    const counts = { ABIERTO: 0, EN_ATENCION: 0, RESUELTO: 0, ESCALADO: 0, SLA_VENCIDO: 0 };
    const now = new Date();
    summary?.forEach((r: any) => {
      if (r.status in counts) counts[r.status as keyof typeof counts]++;
      if (r.sla_deadline && new Date(r.sla_deadline) < now && r.status !== 'RESUELTO') {
        counts.SLA_VENCIDO++;
      }
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
      case 'create': {
        const { chat_thread_id, client_name, severity, category, sla_deadline } = body;
        const { data, error } = await supabase.from('ops_urgencies').insert({
          chat_thread_id,
          client_name,
          severity,
          category,
          sla_deadline,
        }).select().single();
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }

      case 'update_status': {
        const { id, status, first_response_at, resolution_sentiment } = body;
        const update: Record<string, any> = { status, updated_at: new Date().toISOString() };
        if (first_response_at) update.first_response_at = first_response_at;
        if (resolution_sentiment) update.resolution_sentiment = resolution_sentiment;

        const { error } = await supabase.from('ops_urgencies').update(update).eq('id', id);
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
