/**
 * Webhook: Descargas - Documento Actualizado
 * Notificación inmediata cuando se actualiza un documento en Descargas
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications/create';
import { sendNotificationEmail } from '@/lib/notifications/send-email';
import { getDeepLink } from '@/lib/notifications/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { insurer_id, doc_id, doc_name } = body;

    if (!insurer_id || !doc_id || !doc_name) {
      return NextResponse.json(
        { error: 'insurer_id, doc_id y doc_name son requeridos' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServer();

    // Obtener datos de la aseguradora
    const { data: insurer, error: insurerError } = await supabase
      .from('insurers')
      .select('id, name')
      .eq('id', insurer_id)
      .single();

    if (insurerError || !insurer) {
      return NextResponse.json(
        { error: 'Aseguradora no encontrada' },
        { status: 404 }
      );
    }

    // Deep link
    const deepLink = getDeepLink('download', {
      insurer_id,
      doc_id
    });

    // Obtener todos los perfiles activos (brokers y masters)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['master', 'broker']);

    if (profilesError || !profiles) {
      return NextResponse.json(
        { error: 'Error obteniendo usuarios' },
        { status: 500 }
      );
    }

    const results = {
      total: profiles.length,
      sent: 0,
      errors: 0
    };

    // Notificar a todos (ALL)
    for (const profile of profiles) {
      try {
        if (!profile.email) {
          console.warn(`Usuario ${profile.id} sin email`);
          results.errors++;
          continue;
        }

        // Crear notificación
        const notification = await createNotification({
          type: 'download',
          target: 'ALL',
          title: `Descargas actualizadas en ${insurer.name}`,
          body: `Documento actualizado: ${doc_name}`,
          brokerId: profile.role === 'broker' ? profile.id : undefined,
          meta: {
            cta_url: deepLink,
            insurer_id,
            insurer_name: insurer.name,
            doc_id,
            doc_name
          }
        });

        if (!notification.success) {
          console.error('Error creando notificación:', notification.error);
          results.errors++;
          continue;
        }

        // Enviar email
        const emailData = {
          userName: profile.full_name || 'Usuario',
          insurerName: insurer.name,
          docName: doc_name,
          deepLink
        };

        const emailResult = await sendNotificationEmail({
          type: 'download',
          to: profile.email,
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
        console.error(`Error procesando usuario ${profile.id}:`, error);
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        insurer: insurer.name,
        document: doc_name
      }
    });
  } catch (error: any) {
    console.error('Error en webhook downloads/updated:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
