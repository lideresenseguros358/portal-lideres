import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Audit Logs API
// ═══════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entity_type');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('ops_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (entityType) query = query.eq('entity_type', entityType);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data, total: count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
