import { NextResponse } from 'next/server';
import { runRenewalNotifications } from '@/lib/notifications/renewals';
import { getAuthContext } from '@/lib/db/context';

/**
 * Endpoint para ejecutar verificación de pólizas vencidas y próximas a vencer
 * Puede ser llamado manualmente o por un cron job
 */
export async function POST(request: Request) {
  try {
    const { role } = await getAuthContext();
    
    // Solo master puede ejecutar este endpoint
    if (role !== 'master') {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }

    const { type } = await request.json();

    let results;

    switch (type) {
      case 'expired':
        // Pólizas ya vencidas
        results = await runRenewalNotifications({ daysBefore: 'expired' });
        break;
      case '30d':
        // 30 días antes
        results = await runRenewalNotifications({ daysBefore: 30 });
        break;
      case '7d':
        // 7 días antes
        results = await runRenewalNotifications({ daysBefore: 7 });
        break;
      case '0d':
        // Día de vencimiento
        results = await runRenewalNotifications({ daysBefore: 0 });
        break;
      case '60d-delete':
        // 60 días después - eliminación
        results = await runRenewalNotifications({ daysBefore: -60 });
        break;
      case 'all':
        // Ejecutar todas las verificaciones
        const expiredResults = await runRenewalNotifications({ daysBefore: 'expired' });
        const thirtyDayResults = await runRenewalNotifications({ daysBefore: 30 });
        const sevenDayResults = await runRenewalNotifications({ daysBefore: 7 });
        const zeroDayResults = await runRenewalNotifications({ daysBefore: 0 });
        
        results = {
          ok: true,
          expired: expiredResults,
          thirtyDay: thirtyDayResults,
          sevenDay: sevenDayResults,
          zeroDay: zeroDayResults,
        };
        break;
      default:
        return NextResponse.json({ ok: false, error: 'Tipo de verificación no válido' }, { status: 400 });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error en verificación de renovaciones:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error interno del servidor' 
    }, { status: 500 });
  }
}

/**
 * GET: Ejecutar verificación desde cron job o llamada externa
 * Query params: ?type=expired|30d|7d|0d|60d-delete|all
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    // Validar tipo
    const validTypes = ['expired', '30d', '7d', '0d', '60d-delete', 'all'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        ok: false,
        error: `Tipo inválido. Use uno de: ${validTypes.join(', ')}`,
      }, { status: 400 });
    }

    let results;

    switch (type) {
      case 'expired':
        results = await runRenewalNotifications({ daysBefore: 'expired' });
        break;
      case '30d':
        results = await runRenewalNotifications({ daysBefore: 30 });
        break;
      case '7d':
        results = await runRenewalNotifications({ daysBefore: 7 });
        break;
      case '0d':
        results = await runRenewalNotifications({ daysBefore: 0 });
        break;
      case '60d-delete':
        results = await runRenewalNotifications({ daysBefore: -60 });
        break;
      case 'all':
        const expiredResults = await runRenewalNotifications({ daysBefore: 'expired' });
        const thirtyDayResults = await runRenewalNotifications({ daysBefore: 30 });
        const sevenDayResults = await runRenewalNotifications({ daysBefore: 7 });
        const zeroDayResults = await runRenewalNotifications({ daysBefore: 0 });
        
        results = {
          ok: true,
          timestamp: new Date().toISOString(),
          expired: expiredResults,
          thirtyDay: thirtyDayResults,
          sevenDay: sevenDayResults,
          zeroDay: zeroDayResults,
        };
        break;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error en verificación GET de renovaciones:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error interno del servidor' 
    }, { status: 500 });
  }
}
