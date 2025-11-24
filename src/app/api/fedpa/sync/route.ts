import { NextResponse } from 'next/server';
import { fedpaSyncService } from '@/lib/services/fedpa-sync';

/**
 * API Endpoint para sincronizar datos con FEDPA
 * POST /api/fedpa/sync
 * Body: { policyId?: string } - Si se omite, sincroniza todas
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { policyId } = body;

    if (policyId) {
      // Sincronizar una póliza específica
      const result = await fedpaSyncService.syncPolicy(policyId);
      
      return NextResponse.json(result, {
        status: result.success ? 200 : 400,
      });
    } else {
      // Sincronizar todas las pólizas
      const result = await fedpaSyncService.syncAllPolicies();
      
      return NextResponse.json(result, {
        status: result.success ? 200 : 500,
      });
    }
  } catch (error) {
    console.error('[API FEDPA Sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fedpa/sync/status
 * Verificar el estado de la API de FEDPA
 */
export async function GET() {
  try {
    const { fedpaService } = await import('@/lib/integrations/fedpa');
    const isHealthy = await fedpaService.healthCheck();
    
    return NextResponse.json({
      success: true,
      fedpaAvailable: isHealthy,
      message: isHealthy ? 'API de FEDPA disponible' : 'API de FEDPA no disponible',
    });
  } catch (error) {
    console.error('[API FEDPA Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        fedpaAvailable: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
