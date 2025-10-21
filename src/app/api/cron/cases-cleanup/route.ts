// Cron job: Auto-cleanup expired cases
// Run daily at 1:00 AM
// Move cases to trash if: overdue + no update for 7 days

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find cases that are:
    // 1. Overdue (sla_date < today)
    // 2. Not updated in 7 days
    // 3. Not already deleted
    const { data: expiredCases, error } = await supabase
      .from('cases')
      .select('id, case_number, broker_id, client_name')
      .lt('sla_date', now.toISOString())
      .lt('updated_at', sevenDaysAgo.toISOString())
      .eq('is_deleted', false)
      .not('status', 'in', '(CERRADO,EMITIDO)');

    if (error) {
      console.error('Error fetching expired cases:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!expiredCases || expiredCases.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: 'No expired cases to clean up',
        moved_count: 0 
      });
    }

    const caseIds = expiredCases.map(c => c.id);

    // Move to trash
    const { error: updateError } = await supabase
      .from('cases')
      .update({
        is_deleted: true,
        deleted_at: now.toISOString(),
        deleted_reason: 'Auto-limpieza: Vencido sin actualización por 7 días',
      })
      .in('id', caseIds);

    if (updateError) {
      console.error('Error moving cases to trash:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Add history entries
    const historyEntries = caseIds.map(id => ({
      case_id: id,
      action: 'AUTO_TRASH',
      metadata: {
        reason: 'Vencido sin actualización por 7 días',
        automated: true,
      },
    }));

    await supabase.from('case_history').insert(historyEntries);

    // Notify affected brokers
    const uniqueBrokers = [...new Set(expiredCases.map(c => c.broker_id).filter(Boolean))];
    
    for (const brokerId of uniqueBrokers) {
      const brokerCases = expiredCases.filter(c => c.broker_id === brokerId);
      
      await supabase.from('notifications').insert([{
        broker_id: brokerId,
        notification_type: 'other',
        title: 'Casos movidos a papelera',
        body: `${brokerCases.length} caso(s) vencido(s) se movieron a papelera automáticamente`,
        target: '/cases?status=deleted',
      }]);
    }

    return NextResponse.json({
      ok: true,
      message: `Moved ${caseIds.length} expired cases to trash`,
      moved_count: caseIds.length,
      case_ids: caseIds,
    });

  } catch (error: any) {
    console.error('Error in cases cleanup cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
