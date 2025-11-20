/**
 * Webhook: Guías - Documento Actualizado
 * Notificación inmediata cuando se actualiza una guía
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
    const { guide_id, section, title } = body;

    if (!guide_id || !section || !title) {
      return NextResponse.json(
        { error: 'guide_id, section y title son requeridos' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServer();

    // Deep link
    const deepLink = getDeepLink('guide', {
      guide_id,
      section
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

        // Crear notificación (SOLO CAMPANITA - NO EMAIL)
        const notification = await createNotification({
          type: 'guide',
          target: 'ALL',
          title: `📚 Guías Actualizadas`,
          body: `Se actualizó: ${title} en ${section}`,
          brokerId: profile.role === 'broker' ? profile.id : undefined,
          meta: {
            cta_url: deepLink,
            guide_id,
            section,
            title
          }
        });

        if (notification.success) {
          results.sent++;
        } else {
          console.error('Error creando notificación:', notification.error);
          results.errors++;
        }
        
        // NO se envía email para guías según especificación
      } catch (error) {
        console.error(`Error procesando usuario ${profile.id}:`, error);
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        section,
        title
      }
    });
  } catch (error: any) {
    console.error('Error en webhook guides/updated:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
