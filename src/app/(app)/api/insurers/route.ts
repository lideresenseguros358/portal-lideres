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
      console.error('❌ Error fetching insurers:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('📊 Total insurers en BD:', insurers?.length || 0);
    console.log('📋 Insurers raw:', insurers);

    const mappedInsurers = insurers?.map(ins => ({
      id: ins.id,
      name: ins.name,
      logo_url: ins.logo_url,
      is_active: ins.active ?? true,
    })) || [];

    const activeCount = mappedInsurers.filter(i => i.is_active).length;
    console.log('✅ Insurers activos:', activeCount, '/', mappedInsurers.length);

    return NextResponse.json({
      success: true,
      insurers: mappedInsurers,
    });
  } catch (error: any) {
    console.error('❌ Error in GET /api/insurers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
