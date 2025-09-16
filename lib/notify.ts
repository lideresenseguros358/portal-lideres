// /lib/notify.ts
import { supabaseAdmin } from './supabaseAdmin';

type NotiPayload = {
  brokerId?: string | null;
  audience: 'broker' | 'all'; // si es null y audience='all', es broadcast
  type: 'policy_renewal' | 'warning_60' | 'calendar' | 'fortnight_closed' | 'custom';
  title: string;
  body?: string;
  meta?: Record<string, any>;
};

export async function createNotification(p: NotiPayload) {
  const payload = {
    broker_id: p.brokerId ?? null,
    audience: p.audience,
    type: p.type,
    title: p.title,
    body: p.body ?? '',
    meta: p.meta ?? {},
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from('notifications').insert(payload);
  if (error) throw error;
}
