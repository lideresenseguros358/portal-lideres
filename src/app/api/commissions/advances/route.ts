import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const fortnight_id = request.nextUrl.searchParams.get('fortnight_id');
    const broker_id = request.nextUrl.searchParams.get('broker_id');
    const status = request.nextUrl.searchParams.get('status');
    
    let query = supabase
      .from('advances')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Filtrar por broker_id si se proporciona
    if (broker_id) {
      query = query.eq('broker_id', broker_id);
    }
    
    // Filtrar por status si se proporciona (puede ser múltiples separados por coma)
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else {
        query = query.in('status', statuses);
      }
    }
    
    // If fortnight_id provided, filter by date range
    if (fortnight_id) {
      // Get fortnight dates first
      const { data: fortnight } = await supabase
        .from('fortnights')
        .select('period_start, period_end')
        .eq('id', fortnight_id)
        .single();
      
      if (fortnight) {
        query = query
          .gte('created_at', fortnight.period_start)
          .lte('created_at', fortnight.period_end);
      }
    }
    
    const { data, error } = await query;
    
    if (error) throw new Error(error.message);
    
    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
