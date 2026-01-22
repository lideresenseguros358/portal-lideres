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
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs'; // IMAP requiere Node runtime, no Edge
export const maxDuration = 60; // Max 60 segundos para serverless

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  let runId: string | null = null;

  try {
    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    const xCronSecret = request.headers.get('x-cron-secret');
    const cronSecret = process.env.CRON_SECRET;

    // Aceptar Bearer token o x-cron-secret header
    const providedSecret = authHeader?.replace('Bearer ', '') || xCronSecret;

    if (cronSecret && providedSecret !== cronSecret) {
      console.log('[CRON IMAP] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[CRON IMAP] Starting ingestion cycle');

    // 📊 HEARTBEAT: Log inicio
    const { data: runData } = await supabase
      .from('cron_runs')
      .insert({
        job_name: 'imap-ingest',
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select()
      .single();

    runId = runData?.id || null;

    // Ejecutar ingestión
    const result = await runIngestionCycle();

    console.log('[CRON IMAP] Ingestion completed:', result);

    // 📊 HEARTBEAT: Log finalización
    if (runId) {
      await supabase
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: result.success ? 'success' : 'failed',
          processed_count: result.messagesProcessed,
          error_message: result.errors.length > 0 ? `${result.errors.length} errors occurred` : null,
          metadata: {
            messagesProcessed: result.messagesProcessed,
            casesCreated: result.casesCreated,
            casesLinked: result.casesLinked,
            errorsCount: result.errors.length,
          },
        })
        .eq('id', runId);
    }

    // Respuesta
    return NextResponse.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      runId,
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

    // 📊 HEARTBEAT: Log error
    if (runId) {
      await supabase
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'failed',
          error_message: error.message || 'Fatal error',
          error_stack: error.stack || null,
        })
        .eq('id', runId);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
        runId,
      },
      { status: 500 }
    );
  }
}
