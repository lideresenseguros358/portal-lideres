// /lib/notify.ts
import { supabase } from './supabase-client';

type NotiPayload = {
  brokerId?: string | null;
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
  const { error } = await supabase.from('notifications').insert(payload);
  if (error) throw error;
}



