/**
 * Cron Job: Renovaciones Diarias
 * Ejecuta diariamente a las 12:00 UTC (7:00am UTC-5)
 * 
 * Sistema de Notificaciones:
 * - VENCIDAS (expired): Broker + Master reciben con botón "Ya renovó"
 * - 30 días antes (30d): Broker siempre recibe, Master solo si notify_broker_renewals o es Oficina
 * - 7 días antes (7d): Solo broker recibe
 * - Día de vencimiento (0d): SOLO Master recibe
 * - 60 días post-vencimiento (60d-delete): Broker + Master reciben
 */

import { NextRequest, NextResponse } from 'next/server';
import { runRenewalNotifications } from '@/lib/notifications/renewals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Verificar autorización (Vercel Cron Secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ejecutar todas las verificaciones de renovación
    const expiredResults = await runRenewalNotifications({ daysBefore: 'expired' });
    const thirtyDayResults = await runRenewalNotifications({ daysBefore: 30 });
    const sevenDayResults = await runRenewalNotifications({ daysBefore: 7 });
    const zeroDayResults = await runRenewalNotifications({ daysBefore: 0 });
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        expired: expiredResults,
        thirtyDay: thirtyDayResults,
        sevenDay: sevenDayResults,
        zeroDay: zeroDayResults,
      }
    });
  } catch (error: any) {
    console.error('Error en cron renewals-daily:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
