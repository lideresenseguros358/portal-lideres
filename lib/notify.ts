// /lib/notify.ts
import { supabaseAdmin } from './supabase-client';

type NotiPayload = {
  brokerId?: string | null; // si null y audience='all', es broadcast
  audience?: 'broker' | 'master' | 'all';
  type: 'policy_renewal' | 'aging_60' | 'calendar' | 'fortnight_closed' | 'custom';
  title: string;
  body?: string;
  meta?: Record<string, any>;
};

export async function createNotification(p: NotiPayload) {
  const payload = {
    broker_id: p.brokerId ?? null,
    audience: p.audience ?? (p.brokerId ? 'broker' : 'all'),
    type: p.type,
    title: p.title,
    body: p.body ?? '',
    meta: p.meta ?? {},
  };
  const { error } = await supabaseAdmin.from('notifications').insert(payload);
  if (error) throw error;
}
