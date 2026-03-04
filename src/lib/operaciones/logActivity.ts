import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Log a user action to ops_activity_log.
 * Fire-and-forget — never throws to caller.
 */
export async function logActivity(params: {
  userId: string | null;
  actionType: string;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, any>;
}) {
  try {
    const supabase = getSupabaseAdmin() as any;
    await supabase.from('ops_activity_log').insert({
      user_id: params.userId,
      action_type: params.actionType,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      metadata: params.metadata || null,
    });
  } catch (err) {
    console.warn('[logActivity] Failed (non-blocking):', err);
  }
}
