/**
 * CRON ENDPOINT - IMAP Ingest
 * ============================
 * Endpoint llamado por Vercel Cron cada 3 minutos
 * Ejecuta ciclo de ingestión de correos desde Zoho IMAP
 * 
 * Seguridad: Verificar Authorization header con CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { runIngestionCycle } from '@/lib/imap/imapIngestor';

export const runtime = 'nodejs'; // IMAP requiere Node runtime, no Edge
export const maxDuration = 60; // Max 60 segundos para serverless

export async function GET(request: NextRequest) {
  try {
    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CRON IMAP] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[CRON IMAP] Starting ingestion cycle');

    // Ejecutar ingestión
    const result = await runIngestionCycle();

    console.log('[CRON IMAP] Ingestion completed:', result);

    // Respuesta
    return NextResponse.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      stats: {
        messagesProcessed: result.messagesProcessed,
        casesCreated: result.casesCreated,
        casesLinked: result.casesLinked,
        errors: result.errors.length,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error: any) {
    console.error('[CRON IMAP] Fatal error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
