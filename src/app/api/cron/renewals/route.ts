import { NextRequest, NextResponse } from 'next/server';
import { runRenewalNotifications } from '@/lib/notifications/renewals';

/**
 * Cron Job: Renovaciones
 * Ejecuta alertas escalonadas de renovación de pólizas
 * 
 * Query params:
 * - days: 30 | 7 | 0 | -60
 *   - 30: Alerta 30 días antes
 *   - 7: Alerta 7 días antes
 *   - 0: Alerta día de vencimiento
 *   - -60: Eliminación automática (60 días post-vencimiento)
 */
export async function GET(request: NextRequest) {
  // Verificar header de seguridad
  const cronSecret = request.headers.get('x-cron-secret');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    // Obtener parámetro days de la query
    const searchParams = request.nextUrl.searchParams;
    const daysParam = searchParams.get('days');
    const daysBefore = daysParam ? parseInt(daysParam, 10) : 30;
    
    // Validar parámetro
    if (![30, 7, 0, -60].includes(daysBefore)) {
      return NextResponse.json(
        { error: 'Invalid days parameter. Must be 30, 7, 0, or -60' },
        { status: 400 }
      );
    }
    
    const result = await runRenewalNotifications({ daysBefore });
    
    return NextResponse.json({
      success: true,
      ...result,
      days_before: daysBefore,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error running renewal notifications:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
