import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { searchParams } = new URL(request.url);
    const insurerId = searchParams.get('insurerId');
    const brokerId = searchParams.get('brokerId');
    const search = searchParams.get('search');

    let query = supabase
      .from('delinquency')
      .select('*');

    if (insurerId) {
      query = query.eq('insurer_id', insurerId);
    }

    if (brokerId) {
      query = query.eq('broker_id', brokerId);
    }

    if (search) {
      query = query.or(
        `policy_number.ilike.%${search}%,client_name.ilike.%${search}%`
      );
    }

    query = query
      .gt('total_debt', 0)
      .order('total_debt', { ascending: false });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
