import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await getSupabaseServer();

    const { data: insurers, error } = await supabase
      .from('insurers')
      .select('id, name, logo_url, active')
      .order('name');

    if (error) {
      console.error('Error fetching insurers:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      insurers: insurers.map(ins => ({
        id: ins.id,
        name: ins.name,
        logo_url: ins.logo_url,
        is_active: ins.active ?? true,
      })),
    });
  } catch (error: any) {
    console.error('Error in GET /api/insurers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
