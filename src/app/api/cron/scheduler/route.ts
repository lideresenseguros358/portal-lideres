/**
 * CRON JOB: SCHEDULER
 * ===================
 * Ejecuta cada 5 minutos
 * Procesa jobs programados en scheduled_jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  // Verificar autenticación del cron
  const cronSecret = request.headers.get('x-cron-secret');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Obtener jobs pendientes que ya deben ejecutarse
    const { data: jobs, error } = await supabase
      .rpc('get_pending_jobs');

    if (error) {
      throw error;
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending jobs',
        processed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const results = {
      total: jobs.length,
      completed: 0,
      failed: 0,
    };

    // Procesar cada job
    for (const job of jobs) {
      try {
        // Marcar como processing
        await supabase
          .from('scheduled_jobs')
          .update({ status: 'processing' })
          .eq('id', job.id);

        // Ejecutar según el tipo de job
        await executeJob(job);

        // Marcar como completed
        await supabase
          .from('scheduled_jobs')
          .update({
            status: 'completed',
            executed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        results.completed++;

      } catch (jobError) {
        console.error(`[SCHEDULER] Error executing job ${job.id}:`, jobError);

        // Marcar como failed e incrementar retry_count
        await supabase
          .from('scheduled_jobs')
          .update({
            status: job.retry_count + 1 >= 3 ? 'failed' : 'pending',
            retry_count: job.retry_count + 1,
            error: jobError instanceof Error ? jobError.message : 'Unknown error',
          })
          .eq('id', job.id);

        results.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });

  } catch (error) {
    console.error('[CRON] Error in scheduler job:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Ejecutar un job según su tipo
 */
async function executeJob(job: any): Promise<void> {
  const { job_type, payload } = job;

  switch (job_type) {
    case 'email_reminder':
      await sendReminderEmail(payload);
      break;

    case 'email_retry':
      await retryEmail(payload);
      break;

    case 'deferred_notification':
      await sendDeferredNotification(payload);
      break;

    default:
      throw new Error(`Unknown job type: ${job_type}`);
  }
}

/**
 * Enviar correo recordatorio
 */
async function sendReminderEmail(payload: any): Promise<void> {
  const { to, template, data, fromType } = payload;

  const html = renderEmailTemplate(template, data);

  await sendEmail({
    to,
    subject: data.subject || 'Recordatorio',
    html,
    fromType: fromType || 'PORTAL',
    template,
    metadata: { jobType: 'reminder', ...data },
  });
}

/**
 * Reintentar envío de correo
 */
async function retryEmail(payload: any): Promise<void> {
  const { to, subject, html, fromType } = payload;

  await sendEmail({
    to,
    subject,
    html,
    fromType: fromType || 'PORTAL',
    metadata: { jobType: 'retry' },
  });
}

/**
 * Enviar notificación diferida
 */
async function sendDeferredNotification(payload: any): Promise<void> {
  // Implementar según necesidad
  // Puede crear notificaciones en DB o enviar correos
  console.log('[SCHEDULER] Deferred notification:', payload);
}
