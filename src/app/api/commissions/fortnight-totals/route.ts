import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const fortnight_id = request.nextUrl.searchParams.get('fortnight_id');
    
    if (!fortnight_id) {
      return NextResponse.json([]);
    }
    
    const { data, error } = await supabase
      .from('fortnight_broker_totals')
      .select('*')
      .eq('fortnight_id', fortnight_id);
    
    if (error) throw new Error(error.message);
    
    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
