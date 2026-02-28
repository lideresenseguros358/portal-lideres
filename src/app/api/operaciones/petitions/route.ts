import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Petitions API
// ═══════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const ramo = searchParams.get('ramo');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('ops_petitions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (ramo) query = query.eq('ramo', ramo);
    if (search) query = query.or(`client_name.ilike.%${search}%,ticket_number.ilike.%${search}%`);

    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // Summary counts
    const { data: summary } = await supabase.from('ops_petitions').select('status');
    const counts = { PENDIENTE: 0, EN_GESTION: 0, ENVIADO: 0, CERRADO: 0, PERDIDO: 0 };
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
      case 'create': {
        const { client_name, client_email, client_phone, cedula, ramo, details, ticket_number } = body;
        const { data, error } = await supabase.from('ops_petitions').insert({
          ticket_number,
          client_name,
          client_email,
          client_phone,
          cedula,
          ramo,
          details,
        }).select().single();
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }

      case 'update_status': {
        const { id, status } = body;
        const { error } = await supabase.from('ops_petitions').update({
          status,
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
