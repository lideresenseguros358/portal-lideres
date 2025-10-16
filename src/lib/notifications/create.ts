/**
 * Create Notification
 * Helper para crear notificaciones con idempotencia
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { TablesInsert } from '@/lib/supabase/admin';
import { generateNotificationHash, type NotificationType, type NotificationTarget } from './utils';

export interface CreateNotificationParams {
  type: NotificationType;
  target: NotificationTarget;
  title: string;
  body: string;
  brokerId?: string;
  meta?: Record<string, any>;
  entityId?: string;
  condition?: string;
}

export interface CreateNotificationResult {
  success: boolean;
  notificationId?: string;
  isDuplicate?: boolean;
  error?: any;
}

/**
 * Crea una notificación con verificación de idempotencia
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<CreateNotificationResult> {
  const supabase = getSupabaseAdmin();

  try {
    // 1. Generar hash de idempotencia si se proporciona entityId
    let hash: string | null = null;
    if (params.entityId) {
      hash = generateNotificationHash(params.type, params.entityId, params.condition);

      // 2. Verificar si ya existe este hash
      const { data: existingHash } = await supabase
        .from('notification_uniques')
        .select('id')
        .eq('hash', hash)
        .single();

      if (existingHash) {
        // Ya existe, no crear duplicado
        return {
          success: true,
          isDuplicate: true
        };
      }
    }

    // 3. Crear notificación
    const notification: TablesInsert<'notifications'> = {
      notification_type: params.type as any, // Cast temporal hasta ejecutar migración de carnet_renewal
      target: params.target,
      title: params.title,
      body: params.body,
      broker_id: params.brokerId || null,
      meta: params.meta || {},
      email_sent: false
    };

    const { data: newNotification, error: notificationError } = await supabase
      .from('notifications')
      .insert([notification])
      .select('id')
      .single();

    if (notificationError) throw notificationError;

    // 4. Guardar hash si se generó
    if (hash) {
      const { error: hashError } = await supabase
        .from('notification_uniques')
        .insert([{ hash }]);

      if (hashError) {
        console.error('Error guardando hash de idempotencia:', hashError);
        // No fallar si el hash ya existe (race condition)
      }
    }

    return {
      success: true,
      notificationId: newNotification.id,
      isDuplicate: false
    };
  } catch (error) {
    console.error('Error creando notificación:', error);
    return {
      success: false,
      error
    };
  }
}

/**
 * Marca una notificación como enviada por email
 */
export async function markNotificationEmailSent(notificationId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ email_sent: true })
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marcando notificación como enviada:', error);
    return false;
  }
}
