/**
 * Webhook: Morosidad - Import Finalizado
 * Notificación inmediata cuando se actualiza morosidad de aseguradora
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications/create';
import { sendNotificationEmail } from '@/lib/notifications/send-email';
import { getDeepLink } from '@/lib/notifications/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { insurer_id, as_of_date } = body;

    if (!insurer_id || !as_of_date) {
      return NextResponse.json(
        { error: 'insurer_id y as_of_date son requeridos' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServer();

    // Obtener datos de la aseguradora
    const { data: insurer, error: insurerError } = await supabase
      .from('insurers')
      .select('id, name')
      .eq('id', insurer_id)
      .single();

    if (insurerError || !insurer) {
      return NextResponse.json(
        { error: 'Aseguradora no encontrada' },
        { status: 404 }
      );
    }

    // Obtener pólizas con deuda de esta aseguradora
    const { data: delinquentPolicies } = await supabase
      .from('delinquency')
      .select(`
        id,
        policy_id,
        outstanding_balance,
        policies (
          id,
          policy_number,
          broker_id,
          brokers (
            id,
            profiles (id, full_name, email)
          )
        )
      `)
      .eq('insurer_id', insurer_id)
      .eq('as_of_date', as_of_date)
      .gt('outstanding_balance', 0) as any;

    // Agrupar por broker
    const brokersMap = new Map();
    let totalDebt = 0;
    let policiesCount = 0;

    if (delinquentPolicies) {
      for (const delinquency of delinquentPolicies) {
        totalDebt += delinquency.outstanding_balance || 0;
        policiesCount++;

        const policy = delinquency.policies;
        if (policy?.broker_id && policy.brokers?.profiles) {
          if (!brokersMap.has(policy.broker_id)) {
            brokersMap.set(policy.broker_id, {
              profile: policy.brokers.profiles,
              policiesCount: 0,
              totalDebt: 0
            });
          }
          const brokerData = brokersMap.get(policy.broker_id);
          brokerData.policiesCount++;
          brokerData.totalDebt += delinquency.outstanding_balance || 0;
        }
      }
    }

    // Deep link
    const deepLink = getDeepLink('delinquency', {
      insurer_id,
      date: as_of_date
    });

    const results = {
      total: brokersMap.size,
      sent: 0,
      errors: 0
    };

    // Notificar a cada broker afectado
    for (const [brokerId, brokerData] of brokersMap.entries()) {
      try {
        const profile = brokerData.profile;

        if (!profile.email) {
          console.warn(`Broker ${brokerId} sin email`);
          results.errors++;
          continue;
        }

        // Crear notificación
        const notification = await createNotification({
          type: 'delinquency',
          target: 'BROKER',
          title: 'Morosidad actualizada',
          body: `${insurer.name} - ${brokerData.policiesCount} pólizas en mora`,
          brokerId,
          meta: {
            cta_url: deepLink,
            insurer_id,
            insurer_name: insurer.name,
            as_of_date,
            policies_count: brokerData.policiesCount,
            total_debt: brokerData.totalDebt
          }
        });

        if (!notification.success) {
          console.error('Error creando notificación:', notification.error);
          results.errors++;
          continue;
        }

        // Enviar email
        const emailData = {
          userName: profile.full_name || 'Corredor',
          insurerName: insurer.name,
          asOfDate: as_of_date,
          policiesCount: brokerData.policiesCount,
          totalDebt: brokerData.totalDebt,
          deepLink
        };

        const emailResult = await sendNotificationEmail({
          type: 'delinquency',
          to: profile.email,
          data: emailData,
          notificationId: notification.notificationId
        });

        if (emailResult.success) {
          results.sent++;
        } else {
          console.error('Error enviando email:', emailResult.error);
          results.errors++;
        }
      } catch (error) {
        console.error(`Error procesando broker ${brokerId}:`, error);
        results.errors++;
      }
    }

    // También notificar al Master
    try {
      const { data: masters } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'master');

      if (masters && masters.length > 0) {
        for (const master of masters) {
          if (!master.email) continue;

          const notification = await createNotification({
            type: 'delinquency',
            target: 'MASTER',
            title: 'Morosidad actualizada',
            body: `${insurer.name} - ${policiesCount} pólizas en mora`,
            meta: {
              cta_url: deepLink,
              insurer_id,
              insurer_name: insurer.name,
              as_of_date,
              policies_count: policiesCount,
              total_debt: totalDebt
            }
          });

          if (notification.success) {
            await sendNotificationEmail({
              type: 'delinquency',
              to: master.email,
              data: {
                userName: master.full_name || 'Master',
                insurerName: insurer.name,
                asOfDate: as_of_date,
                policiesCount,
                totalDebt,
                deepLink
              },
              notificationId: notification.notificationId
            });
          }
        }
      }
    } catch (error) {
      console.error('Error notificando a masters:', error);
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        insurer: insurer.name,
        as_of_date,
        total_policies: policiesCount,
        total_debt: totalDebt
      }
    });
  } catch (error: any) {
    console.error('Error en webhook delinquency/import-finished:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
