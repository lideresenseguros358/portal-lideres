import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const fortnight_id = request.nextUrl.searchParams.get('fortnight_id');
    
    let query = supabase
      .from('advances')
      .select('*')
      .order('created_at', { ascending: false });
    
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
    
    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
