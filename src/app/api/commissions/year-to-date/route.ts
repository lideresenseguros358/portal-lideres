import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const year = request.nextUrl.searchParams.get('year') || new Date().getFullYear().toString();
    const broker_id = request.nextUrl.searchParams.get('broker_id');
    
    // Get all closed fortnights for the year
    const { data: fortnights, error: fError } = await supabase
      .from('fortnights')
      .select(`
        id,
        period_start,
        period_end,
        fortnight_broker_totals (
          broker_id,
          gross_amount,
          discounts_json,
          net_amount
        )
      `)
      .eq('status', 'PAID')
      .gte('period_start', `${year}-01-01`)
      .lte('period_end', `${year}-12-31`);
    
    if (fError) throw new Error(fError.message);
    
    // Get brokers info
    const { data: brokers } = await supabase
      .from('brokers')
      .select('id, name');
    
    const brokerMap = new Map(brokers?.map(b => [b.id, b]) || []);
    
    // Aggregate by broker and month
    const brokerTotals = new Map();
    
    for (const fortnight of fortnights || []) {
      const month = new Date(fortnight.period_start).toISOString().substring(0, 7); // YYYY-MM
      
      for (const total of (fortnight as any).fortnight_broker_totals || []) {
        // Filter by broker if specified
        if (broker_id && total.broker_id !== broker_id) continue;
        
        if (!brokerTotals.has(total.broker_id)) {
          const broker = brokerMap.get(total.broker_id);
          brokerTotals.set(total.broker_id, {
            broker_id: total.broker_id,
            broker_name: broker?.name || 'Unknown',
            gross_total: 0,
            discounts_total: 0,
            net_total: 0,
            months: [],
          });
        }
        
        const brokerData = brokerTotals.get(total.broker_id);
        
        // Find or create month entry
        let monthEntry = brokerData.months.find((m: any) => m.month === month);
        if (!monthEntry) {
          monthEntry = { month, gross: 0, discounts: 0, net: 0 };
          brokerData.months.push(monthEntry);
        }
        
        // Calculate discounts total
        const discounts = Array.isArray(total.discounts_json) 
          ? total.discounts_json.reduce((sum: number, d: any) => sum + (d.amount || 0), 0)
          : 0;
        
        // Add to month
        monthEntry.gross += total.gross_amount || 0;
        monthEntry.discounts += discounts;
        monthEntry.net += total.net_amount || 0;
        
        // Add to totals
        brokerData.gross_total += total.gross_amount || 0;
        brokerData.discounts_total += discounts;
        brokerData.net_total += total.net_amount || 0;
      }
    }
    
    // Sort months within each broker
    const result = Array.from(brokerTotals.values()).map(broker => ({
      ...broker,
      months: broker.months.sort((a: any, b: any) => a.month.localeCompare(b.month))
    }));
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
