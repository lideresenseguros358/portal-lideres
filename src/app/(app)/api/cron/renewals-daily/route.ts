/**
 * Cron Job: Renovaciones Diarias
 * Ejecuta diariamente a las 12:00 UTC (7:00am UTC-5)
 * Busca pólizas por renovar y genera notificaciones + emails
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createNotification } from '@/lib/notifications/create';
import { sendNotificationEmail } from '@/lib/notifications/send-email';
import { getDeepLink } from '@/lib/notifications/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Verificar autorización (Vercel Cron Secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]!;

  const results = {
    total: 0,
    sent: 0,
    duplicates: 0,
    errors: 0,
    conditions: {
      '30days': 0,
      'sameday': 0,
      '7expired': 0,
      'daily': 0
    }
  };

  try {
    // Calcular fechas
    const thirtyDaysAhead = new Date(today);
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
    const thirtyDaysAheadStr = thirtyDaysAhead.toISOString().split('T')[0]!;

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]!;

    // 1. CONDICIÓN: 30 días antes
    const { data: policies30Days } = await supabase
      .from('policies')
      .select(`
        id,
        policy_number,
        renewal_date,
        client_id,
        insurer_id,
        clients (id, name, email),
        insurers (id, name),
        brokers (id, profiles (id, full_name, email, notify_broker_renewals))
      `)
      .eq('renewal_date', thirtyDaysAheadStr) as any;

    if (policies30Days) {
      for (const policy of policies30Days) {
        await processRenewalNotification(
          policy,
          '30days',
          supabase,
          results
        );
      }
    }

    // 2. CONDICIÓN: Mismo día
    const { data: policiesToday } = await supabase
      .from('policies')
      .select(`
        id,
        policy_number,
        renewal_date,
        client_id,
        insurer_id,
        clients (id, name, email),
        insurers (id, name),
        brokers (id, profiles (id, full_name, email, notify_broker_renewals))
      `)
      .eq('renewal_date', todayStr) as any;

    if (policiesToday) {
      for (const policy of policiesToday) {
        await processRenewalNotification(
          policy,
          'sameday',
          supabase,
          results
        );
      }
    }

    // 3. CONDICIÓN: 7 días vencida (exacto)
    const { data: policies7Expired } = await supabase
      .from('policies')
      .select(`
        id,
        policy_number,
        renewal_date,
        client_id,
        insurer_id,
        clients (id, name, email),
        insurers (id, name),
        brokers (id, profiles (id, full_name, email, notify_broker_renewals))
      `)
      .eq('renewal_date', sevenDaysAgoStr) as any;

    if (policies7Expired) {
      for (const policy of policies7Expired) {
        await processRenewalNotification(
          policy,
          '7expired',
          supabase,
          results
        );
      }
    }

    // 4. CONDICIÓN: >7 días vencida (todas las pólizas vencidas hace más de 7 días)
    const { data: policiesExpired } = await supabase
      .from('policies')
      .select(`
        id,
        policy_number,
        renewal_date,
        client_id,
        insurer_id,
        clients (id, name, email),
        insurers (id, name),
        brokers (id, profiles (id, full_name, email, notify_broker_renewals))
      `)
      .lt('renewal_date', sevenDaysAgoStr) as any;

    if (policiesExpired) {
      for (const policy of policiesExpired) {
        await processRenewalNotification(
          policy,
          'daily',
          supabase,
          results
        );
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error: any) {
    console.error('Error en cron renewals-daily:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        results
      },
      { status: 500 }
    );
  }
}

/**
 * Procesa notificación de renovación para una póliza
 */
async function processRenewalNotification(
  policy: any,
  condition: '30days' | 'sameday' | '7expired' | 'daily',
  supabase: any,
  results: any
) {
  results.total++;

  try {
    const client = policy.clients;
    const insurer = policy.insurers;
    const broker = policy.brokers?.profiles;

    if (!broker) {
      console.warn(`Póliza ${policy.policy_number} sin broker asignado`);
      results.errors++;
      return;
    }

    // Deep link
    const deepLink = getDeepLink('renewal', { policy_id: policy.id });

    // Crear notificación
    const notification = await createNotification({
      type: 'renewal',
      target: 'BROKER',
      title: `Renovación: ${policy.policy_number}`,
      body: `Cliente: ${client?.name || 'N/A'} - Vence: ${policy.renewal_date}`,
      brokerId: broker.id,
      meta: {
        cta_url: deepLink,
        policy_id: policy.id,
        policy_number: policy.policy_number,
        condition
      },
      entityId: policy.id,
      condition
    });

    if (notification.isDuplicate) {
      results.duplicates++;
      results.conditions[condition]++;
      return;
    }

    if (!notification.success) {
      console.error('Error creando notificación:', notification.error);
      results.errors++;
      return;
    }

    // Preparar destinatarios
    const to: string[] = [];
    const cc: string[] = [];

    // Cliente como destinatario principal (si tiene email)
    const hasClientEmail = client?.email && client.email.trim().length > 0;
    if (hasClientEmail) {
      to.push(client.email);
    }

    // Broker siempre recibe
    if (broker.email) {
      if (hasClientEmail) {
        cc.push(broker.email);
      } else {
        to.push(broker.email);
      }
    }

    // Master si tiene toggle activado
    if (broker.notify_broker_renewals) {
      const { data: masters } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', 'master');

      if (masters && masters.length > 0) {
        masters.forEach((master: any) => {
          if (master.email && !cc.includes(master.email)) {
            cc.push(master.email);
          }
        });
      }
    }

    // Enviar email
    if (to.length > 0) {
      const emailData = {
        clientName: client?.name || 'N/A',
        policyNumber: policy.policy_number,
        insurerName: insurer?.name || 'N/A',
        renewalDate: policy.renewal_date,
        condition,
        brokerName: broker.full_name || 'Corredor',
        clientEmail: hasClientEmail ? client.email : undefined,
        deepLink
      };

      const emailResult = await sendNotificationEmail({
        type: 'renewal',
        to,
        cc: cc.length > 0 ? cc : undefined,
        data: emailData,
        notificationId: notification.notificationId
      });

      if (emailResult.success) {
        results.sent++;
        results.conditions[condition]++;
      } else {
        console.error('Error enviando email:', emailResult.error);
        results.errors++;
      }
    } else {
      console.warn(`Póliza ${policy.policy_number} sin destinatarios de email`);
      results.errors++;
    }
  } catch (error) {
    console.error(`Error procesando póliza ${policy.policy_number}:`, error);
    results.errors++;
  }
}
