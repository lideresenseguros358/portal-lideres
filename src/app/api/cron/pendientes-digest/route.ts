/**
 * CRON JOB: DIGEST DIARIO DE PENDIENTES
 * ======================================
 * Ejecuta diariamente a las 7:00 AM (Panamá)
 * Envía resumen de casos pendientes a cada broker
 * SMTP: portal@lideresenseguros.com
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';
import { generateDedupeKey } from '@/server/email/dedupe';
import { getNowPanama, formatPanama } from '@/lib/timezone/panama';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  // Verificar autenticación del cron
  const cronSecret = request.headers.get('x-cron-secret');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Obtener todos los brokers activos
    const { data: brokers, error: brokersError } = await supabase
      .from('brokers')
      .select('id, name, email, p_id')
      .not('email', 'is', null);

    if (brokersError || !brokers) {
      throw brokersError;
    }

    const result = {
      total_brokers: brokers.length,
      emails_sent: 0,
      emails_failed: 0,
      emails_skipped: 0,
    };

    const now = getNowPanama();

    for (const broker of brokers) {
      try {
        // Obtener casos abiertos del broker
        const { data: cases, error: casesError } = await supabase
          .from('cases')
          .select('id, ticket, client_name, estado_simple, sla_due_date, created_at')
          .eq('broker_id', broker.id)
          .is('deleted_at', null)
          .not('estado_simple', 'in', '(Cerrado aprobado,Cerrado rechazado)');

        if (casesError) {
          console.error(`[DIGEST] Error fetching cases for broker ${broker.id}:`, casesError);
          continue;
        }

        // Si no tiene casos abiertos, saltar
        if (!cases || cases.length === 0) {
          result.emails_skipped++;
          continue;
        }

        // Categorizar casos
        const urgentCases = cases.filter(c => {
          if (!c.sla_due_date) return false;
          const dueDate = new Date(c.sla_due_date);
          return dueDate < now.toJSDate();
        });

        const statusCounts = {
          new: cases.filter(c => c.estado_simple === 'Nuevo').length,
          inProgress: cases.filter(c => c.estado_simple === 'En proceso').length,
          pendingClient: cases.filter(c => c.estado_simple === 'Pendiente cliente').length,
          postponed: cases.filter(c => c.estado_simple === 'Aplazado').length,
        };

        // Renderizar template
        const html = renderEmailTemplate('pendientesDailyDigest', {
          brokerName: broker.name,
          totalCases: cases.length,
          urgentCount: urgentCases.length,
          urgentCases: urgentCases.slice(0, 5).map(c => ({
            ticket: c.ticket,
            clientName: c.client_name,
            slaDate: c.sla_due_date ? formatPanama(c.sla_due_date, 'dd/MM/yyyy HH:mm') : 'N/A',
          })),
          newCount: statusCounts.new,
          inProgressCount: statusCounts.inProgress,
          pendingClientCount: statusCounts.pendingClient,
          postponedCount: statusCounts.postponed,
          portalUrl: appUrl,
        });

        // Enviar correo
        const emailResult = await sendEmail({
          to: broker.email,
          subject: `📊 Resumen diario de Pendientes - ${cases.length} casos`,
          html,
          fromType: 'PORTAL',
          template: 'pendientesDailyDigest',
          dedupeKey: generateDedupeKey(broker.email, 'pendientesDailyDigest', now.toFormat('yyyy-MM-dd')),
          metadata: {
            brokerId: broker.id,
            totalCases: cases.length,
            urgentCases: urgentCases.length,
          },
        });

        if (emailResult.success && !emailResult.skipped) {
          result.emails_sent++;
        } else if (emailResult.skipped) {
          result.emails_skipped++;
        } else {
          result.emails_failed++;
        }

      } catch (error) {
        console.error(`[DIGEST] Error processing broker ${broker.id}:`, error);
        result.emails_failed++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });

  } catch (error) {
    console.error('[CRON] Error in pendientes-digest job:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
