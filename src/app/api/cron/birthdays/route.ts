/**
 * CRON JOB: CUMPLEAÑOS
 * =====================
 * Ejecuta diariamente a las 12:00 PM (Panamá)
 * - Notifica a brokers sobre cumpleaños de sus clientes
 * - Envía felicitaciones a brokers que cumplen años
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendClientBirthdayNotifications, sendBrokerBirthdayGreetings } from '@/lib/email/birthdays';

export async function GET(request: NextRequest) {
  // Verificar autenticación del cron
  const cronSecret = request.headers.get('x-cron-secret');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ejecutar ambas funciones en paralelo
    const [clientResult, brokerResult] = await Promise.all([
      sendClientBirthdayNotifications(),
      sendBrokerBirthdayGreetings(),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      clients: {
        birthdays: clientResult.clientBirthdays,
        emailsSent: clientResult.emailsSent,
        emailsFailed: clientResult.emailsFailed,
      },
      brokers: {
        birthdays: brokerResult.brokerBirthdays,
        emailsSent: brokerResult.emailsSent,
        emailsFailed: brokerResult.emailsFailed,
      },
      totals: {
        totalBirthdays: clientResult.clientBirthdays + brokerResult.brokerBirthdays,
        totalEmailsSent: clientResult.emailsSent + brokerResult.emailsSent,
        totalEmailsFailed: clientResult.emailsFailed + brokerResult.emailsFailed,
      },
    });

  } catch (error) {
    console.error('[CRON] Error in birthdays job:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
