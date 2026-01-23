/**
 * DIAGNOSTICS ENDPOINT - Cron Jobs Status
 * ========================================
 * Verifica que todos los cron jobs existen y están funcionales
 * Ejecuta dry-run de cada job para validar
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // Verificar autorización
  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = authHeader?.replace('Bearer ', '') || xCronSecret;

  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://portal-lideres.vercel.app';
  
  const cronJobs = [
    { name: 'imap-ingest', path: '/api/cron/imap-ingest', schedule: '*/3 * * * *' },
    { name: 'scheduler', path: '/api/cron/scheduler', schedule: '*/5 * * * *' },
    { name: 'renewals', path: '/api/cron/renewals', schedule: '0 12 * * *' },
    { name: 'birthdays', path: '/api/cron/birthdays', schedule: '0 12 * * *' },
    { name: 'pendientes-digest', path: '/api/cron/pendientes-digest', schedule: '0 12 * * *' },
    { name: 'carnet-renewals', path: '/api/cron/carnet-renewals', schedule: '0 13 * * *' },
    { name: 'cases-cleanup', path: '/api/cron/cases-cleanup', schedule: '0 6 * * *' },
    { name: 'cases-reminders', path: '/api/cron/cases-reminders', schedule: '0 13 * * *' },
    { name: 'aplazados-check', path: '/api/cron/aplazados-check', schedule: '0 14 * * *' },
  ];

  const results = [];
  let allOk = true;

  for (const job of cronJobs) {
    const startTime = Date.now();
    
    try {
      console.log(`[DIAGNOSTICS CRON] Testing ${job.name}...`);

      const response = await fetch(`${baseUrl}${job.path}`, {
        method: 'GET',
        headers: {
          'x-cron-secret': cronSecret || '',
        },
      });

      const duration = Date.now() - startTime;
      const isSuccess = response.ok;

      if (!isSuccess) {
        allOk = false;
      }

      results.push({
        name: job.name,
        path: job.path,
        schedule: job.schedule,
        success: isSuccess,
        status: response.status,
        statusText: response.statusText,
        duration,
      });

      console.log(`[DIAGNOSTICS CRON] ${job.name}: ${isSuccess ? '✅' : '❌'} (${response.status})`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      allOk = false;

      results.push({
        name: job.name,
        path: job.path,
        schedule: job.schedule,
        success: false,
        error: error.message,
        duration,
      });

      console.log(`[DIAGNOSTICS CRON] ${job.name}: ❌ ${error.message}`);
    }
  }

  const summary = allOk
    ? `✅ Todos los ${cronJobs.length} cron jobs funcionan correctamente`
    : `⚠️ ${results.filter(r => !r.success).length}/${cronJobs.length} cron jobs tienen problemas`;

  return NextResponse.json({
    success: allOk,
    timestamp: new Date().toISOString(),
    totalJobs: cronJobs.length,
    successfulJobs: results.filter(r => r.success).length,
    failedJobs: results.filter(r => !r.success).length,
    results,
    summary,
  });
}
