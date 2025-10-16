/**
 * Webhook: Comisiones - Pago de Quincena
 * Notificación inmediata cuando se registra pago de quincena
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
    const { quincena_id } = body;

    if (!quincena_id) {
      return NextResponse.json(
        { error: 'quincena_id es requerido' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServer();

    // Obtener datos de la quincena
    const { data: quincena, error: quincenaError } = await supabase
      .from('fortnights')
      .select(`
        id,
        period_start,
        period_end,
        fortnight_broker_totals (
          broker_id,
          gross_amount,
          net_amount,
          brokers (
            id,
            profiles (id, full_name, email)
          )
        )
      `)
      .eq('id', quincena_id)
      .single() as any;

    if (quincenaError || !quincena) {
      return NextResponse.json(
        { error: 'Quincena no encontrada' },
        { status: 404 }
      );
    }

    // Formatear período
    const quincenaPeriod = `${quincena.period_start} al ${quincena.period_end}`;

    // Deep link
    const deepLink = getDeepLink('commission', { quincena_id });

    // Obtener brokers únicos impactados
    const brokersMap = new Map();
    if (quincena.fortnight_broker_totals) {
      for (const item of quincena.fortnight_broker_totals) {
        if (item.broker_id && item.brokers?.profiles) {
          brokersMap.set(item.broker_id, {
            profile: item.brokers.profiles,
            amount: item.net_amount || item.gross_amount
          });
        }
      }
    }

    const results = {
      total: brokersMap.size,
      sent: 0,
      errors: 0
    };

    // Enviar notificación a cada broker
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
          type: 'commission',
          target: 'BROKER',
          title: 'Pago de quincena realizado',
          body: `Se registró el pago de la quincena ${quincenaPeriod}`,
          brokerId,
          meta: {
            cta_url: deepLink,
            quincena_id,
            quincena_period: quincenaPeriod,
            amount: brokerData.amount
          }
        });

        if (!notification.success) {
          console.error('Error creando notificación:', notification.error);
          results.errors++;
          continue;
        }

        // Enviar email
        const emailData = {
          brokerName: profile.full_name || 'Corredor',
          quincenaId: quincena_id,
          quincenaPeriod,
          amount: brokerData.amount,
          deepLink
        };

        const emailResult = await sendNotificationEmail({
          type: 'commission',
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
            type: 'commission',
            target: 'MASTER',
            title: 'Pago de quincena procesado',
            body: `Quincena ${quincenaPeriod} marcada como pagada`,
            meta: {
              cta_url: deepLink,
              quincena_id,
              quincena_period: quincenaPeriod
            }
          });

          if (notification.success) {
            await sendNotificationEmail({
              type: 'commission',
              to: master.email,
              data: {
                brokerName: 'Master',
                quincenaId: quincena_id,
                quincenaPeriod,
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
      results
    });
  } catch (error: any) {
    console.error('Error en webhook commissions/paid:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
