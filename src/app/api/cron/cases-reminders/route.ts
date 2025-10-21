// Cron job: SLA Reminders
// Run daily at 8:00 AM
// Notify brokers about cases due soon (5 days) or overdue

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const fiveDaysFromNow = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);

    // Find cases due soon (within 5 days)
    const { data: dueSoonCases } = await supabase
      .from('cases')
      .select('id, case_number, broker_id, client_name, sla_date, status')
      .gte('sla_date', today.toISOString())
      .lte('sla_date', fiveDaysFromNow.toISOString())
      .eq('is_deleted', false)
      .not('status', 'in', '(CERRADO,EMITIDO)');

    // Find overdue cases
    const { data: overdueCases } = await supabase
      .from('cases')
      .select('id, case_number, broker_id, client_name, sla_date, status')
      .lt('sla_date', today.toISOString())
      .eq('is_deleted', false)
      .not('status', 'in', '(CERRADO,EMITIDO)');

    let notificationsSent = 0;

    // Group by broker and send notifications
    if (dueSoonCases && dueSoonCases.length > 0) {
      const brokerGroups = dueSoonCases.reduce((acc, c) => {
        if (!c.broker_id) return acc;
        if (!acc[c.broker_id]) acc[c.broker_id] = [];
        acc[c.broker_id]!.push(c);
        return acc;
      }, {} as Record<string, typeof dueSoonCases>);

      for (const [brokerId, cases] of Object.entries(brokerGroups)) {
        await supabase.from('notifications').insert([{
          broker_id: brokerId,
          notification_type: 'other',
          title: 'Casos por vencer pronto',
          body: `Tienes ${cases.length} caso(s) con SLA por vencer en los próximos 5 días`,
          target: '/cases?sla=due_soon',
        }]);
        notificationsSent++;
      }
    }

    if (overdueCases && overdueCases.length > 0) {
      const brokerGroups = overdueCases.reduce((acc, c) => {
        if (!c.broker_id) return acc;
        if (!acc[c.broker_id]) acc[c.broker_id] = [];
        acc[c.broker_id]!.push(c);
        return acc;
      }, {} as Record<string, typeof overdueCases>);

      for (const [brokerId, cases] of Object.entries(brokerGroups)) {
        await supabase.from('notifications').insert([{
          broker_id: brokerId,
          notification_type: 'other',
          title: '⚠️ Casos vencidos',
          body: `Tienes ${cases.length} caso(s) con SLA vencido. Requieren atención urgente.`,
          target: '/cases?sla=overdue',
        }]);
        notificationsSent++;
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'SLA reminders processed',
      due_soon_count: dueSoonCases?.length || 0,
      overdue_count: overdueCases?.length || 0,
      notifications_sent: notificationsSent,
    });

  } catch (error: any) {
    console.error('Error in cases reminders cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
