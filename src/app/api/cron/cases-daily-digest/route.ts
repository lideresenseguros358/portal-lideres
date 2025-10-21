// Cron job: Daily Digest Email
// Run daily at 7:00 AM
// Send personalized summary to each broker

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

    // Get all active brokers
    const { data: brokers } = await supabase
      .from('brokers')
      .select('id, name, email, p_id')
      .eq('active', true);

    if (!brokers || brokers.length === 0) {
      return NextResponse.json({ ok: true, message: 'No active brokers' });
    }

    let emailsSent = 0;

    for (const broker of brokers) {
      // Get broker's profile to check notification preferences
      const { data: profile } = await supabase
        .from('profiles')
        .select('notify_broker_renewals')
        .eq('id', broker.p_id)
        .single();

      // Skip if broker disabled notifications
      if (profile && !profile.notify_broker_renewals) {
        continue;
      }

      // Get stats for this broker
      const { data: cases } = await supabase
        .from('cases')
        .select('id, status, sla_date, client_name, ctype')
        .eq('broker_id', broker.p_id)
        .eq('is_deleted', false);

      if (!cases || cases.length === 0) {
        continue;
      }

      // Calculate stats
      const pendingCount = cases.filter(c => 
        c.status === 'PENDIENTE_REVISION' || 
        c.status === 'PENDIENTE_DOCUMENTACION'
      ).length;

      const dueTodayCount = cases.filter(c => {
        if (!c.sla_date) return false;
        const slaDate = new Date(c.sla_date);
        slaDate.setHours(0, 0, 0, 0);
        return slaDate.getTime() === today.getTime();
      }).length;

      const overdueCount = cases.filter(c => {
        if (!c.sla_date) return false;
        const slaDate = new Date(c.sla_date);
        return slaDate < today;
      }).length;

      const inProcessCount = cases.filter(c => 
        c.status === 'EN_PROCESO' || 
        c.status === 'COTIZANDO'
      ).length;

      // Check for preliminares pending
      const { data: preliminares } = await supabase
        .from('policies')
        .select('id, policy_number')
        .eq('is_preliminary', true)
        .eq('created_by', broker.p_id);

      const preliminaresCount = preliminares?.length || 0;

      // Only send if there's something to report
      if (pendingCount + dueTodayCount + overdueCount + preliminaresCount === 0) {
        continue;
      }

      // Create email notification in notifications table
      // (Actual email sending would be handled by a separate email service)
      const emailBody = generateEmailBody({
        brokerName: broker.name || 'Broker',
        pendingCount,
        dueTodayCount,
        overdueCount,
        inProcessCount,
        preliminaresCount,
        totalCases: cases.length,
      });

      await supabase.from('notifications').insert([{
        broker_id: broker.p_id,
        notification_type: 'case_digest',
        title: 'Resumen diario de casos',
        body: emailBody,
        target: '/cases',
        email_sent: false, // Email service will pick this up and send
      }]);

      emailsSent++;
    }

    return NextResponse.json({
      ok: true,
      message: 'Daily digest processed',
      brokers_count: brokers.length,
      emails_queued: emailsSent,
    });

  } catch (error: any) {
    console.error('Error in daily digest cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function generateEmailBody(stats: {
  brokerName: string;
  pendingCount: number;
  dueTodayCount: number;
  overdueCount: number;
  inProcessCount: number;
  preliminaresCount: number;
  totalCases: number;
}): string {
  const parts: string[] = [];
  
  parts.push(`Buenos días ${stats.brokerName},`);
  parts.push(`\nResumen de tus casos (${stats.totalCases} total):`);
  
  if (stats.overdueCount > 0) {
    parts.push(`\n⚠️ ${stats.overdueCount} caso(s) VENCIDO(S) - Requieren atención urgente`);
  }
  
  if (stats.dueTodayCount > 0) {
    parts.push(`\n🔔 ${stats.dueTodayCount} caso(s) vencen HOY`);
  }
  
  if (stats.pendingCount > 0) {
    parts.push(`\n📋 ${stats.pendingCount} caso(s) pendiente(s) de revisión/documentación`);
  }
  
  if (stats.inProcessCount > 0) {
    parts.push(`\n⏳ ${stats.inProcessCount} caso(s) en proceso/cotizando`);
  }
  
  if (stats.preliminaresCount > 0) {
    parts.push(`\n📝 ${stats.preliminaresCount} preliminar(es) pendiente(s) de completar en BD`);
  }
  
  return parts.join('');
}
