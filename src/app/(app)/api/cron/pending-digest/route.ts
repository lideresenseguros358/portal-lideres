/**
 * Cron Job: Pending Digest (Resumen de Casos)
 * Ejecuta diariamente a las 12:00 UTC (7:00am UTC-5)
 * Genera resumen de cambios en casos del día anterior
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createNotification } from '@/lib/notifications/create';
import { sendNotificationEmail } from '@/lib/notifications/send-email';
import { getDeepLink } from '@/lib/notifications/utils';
import type { CaseChange } from '@/lib/email/templates/CaseDigestEmailTemplate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Verificar autorización (Vercel Cron Secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  
  // Fecha de ayer
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = new Date(yesterday);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);
  
  const yesterdayStr = yesterday.toISOString().split('T')[0]!;

  const results = {
    total: 0,
    sent: 0,
    duplicates: 0,
    errors: 0,
    usersProcessed: 0
  };

  try {
    // Obtener todos los cambios del día anterior en case_history
    const { data: historyRecords, error: historyError } = await supabase
      .from('case_history')
      .select(`
        id,
        case_id,
        action,
        description,
        created_at,
        created_by,
        cases (
          id,
          case_number,
          client_name,
          assigned_broker_id
        )
      `)
      .gte('created_at', yesterdayStart.toISOString())
      .lte('created_at', yesterdayEnd.toISOString())
      .order('created_at', { ascending: false }) as any;

    if (historyError) throw historyError;

    if (!historyRecords || historyRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay cambios del día anterior',
        results
      });
    }

    // Agrupar cambios por usuario (broker o master)
    const changesByUser = new Map<string, CaseChange[]>();

    for (const record of historyRecords) {
      const caseData = record.cases;
      if (!caseData) continue;

      // Determinar tipo de cambio
      let changeType: CaseChange['changeType'] = 'other';
      if (record.action.includes('attach') || record.action.includes('file')) {
        changeType = 'attachment';
      } else if (record.action.includes('status') || record.action.includes('estado')) {
        changeType = 'status';
      } else if (record.action.includes('comment') || record.action.includes('comentario')) {
        changeType = 'comment';
      } else if (record.action.includes('assign') || record.action.includes('reasign')) {
        changeType = 'reassignment';
      }

      const change: CaseChange = {
        caseId: caseData.id,
        caseTitle: `#${caseData.case_number} - ${caseData.client_name}`,
        changeType,
        changeDescription: record.description || record.action,
        timestamp: record.created_at
      };

      // Agregar al broker asignado
      if (caseData.assigned_broker_id) {
        if (!changesByUser.has(caseData.assigned_broker_id)) {
          changesByUser.set(caseData.assigned_broker_id, []);
        }
        changesByUser.get(caseData.assigned_broker_id)!.push(change);
      }

      // También agregar a masters
      const { data: masters } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'master');

      if (masters) {
        for (const master of masters) {
          if (!changesByUser.has(master.id)) {
            changesByUser.set(master.id, []);
          }
          changesByUser.get(master.id)!.push(change);
        }
      }
    }

    // Procesar cada usuario
    for (const [userId, changes] of changesByUser.entries()) {
      results.total++;
      results.usersProcessed++;

      try {
        // Obtener datos del usuario
        const { data: user } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', userId)
          .single();

        if (!user || !user.email) {
          console.warn(`Usuario ${userId} sin email`);
          results.errors++;
          continue;
        }

        // Deep link
        const deepLink = getDeepLink('case_digest', { date: yesterdayStr });

        // Crear notificación
        const notification = await createNotification({
          type: 'case_digest',
          target: 'BROKER',
          title: 'Resumen de movimientos en tus casos (ayer)',
          body: `${changes.length} cambios en tus casos del día anterior`,
          brokerId: userId,
          meta: {
            cta_url: deepLink,
            date: yesterdayStr,
            changes_count: changes.length
          },
          entityId: userId,
          condition: yesterdayStr
        });

        if (notification.isDuplicate) {
          results.duplicates++;
          continue;
        }

        if (!notification.success) {
          console.error('Error creando notificación:', notification.error);
          results.errors++;
          continue;
        }

        // Enviar email
        const emailData = {
          userName: user.full_name || 'Usuario',
          date: yesterdayStr,
          changes,
          deepLink
        };

        const emailResult = await sendNotificationEmail({
          type: 'case_digest',
          to: user.email,
          data: emailData,
          notificationId: notification.notificationId
        });

        if (emailResult.success) {
          results.sent++;
        } else {
          console.error('Error enviando email:', emailResult.error);
          results.errors++;
        }
      } catch (error) {
        console.error(`Error procesando usuario ${userId}:`, error);
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error: any) {
    console.error('Error en cron pending-digest:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        results
      },
      { status: 500 }
    );
  }
}
