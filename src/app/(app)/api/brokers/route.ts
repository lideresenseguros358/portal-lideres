import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await getSupabaseServer();

    const { data: brokers, error } = await supabase
      .from('brokers')
      .select('id, name, active')
      .order('name');

    if (error) {
      console.error('❌ Error fetching brokers:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('📊 Total brokers en BD:', brokers?.length || 0);

    const mappedBrokers = brokers?.map(broker => ({
      id: broker.id,
      name: broker.name,
      active: broker.active ?? true,
    })) || [];

    const activeCount = mappedBrokers.filter(b => b.active).length;
    console.log('✅ Brokers activos:', activeCount, '/', mappedBrokers.length);

    return NextResponse.json({
      success: true,
      brokers: mappedBrokers,
    });
  } catch (error: any) {
    console.error('❌ Error in GET /api/brokers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
