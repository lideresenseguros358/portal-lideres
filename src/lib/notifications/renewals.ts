import { getSupabaseAdmin, type Tables } from '@/lib/supabase/admin';

type Policy = Tables<'policies'>;
type Client = Tables<'clients'>;

interface RenewalNotificationOptions {
  daysBefore?: number;
}

export async function runRenewalNotifications(options: RenewalNotificationOptions = {}) {
  const { daysBefore = 30 } = options;
  const supabase = getSupabaseAdmin();
  
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysBefore);
  
  // Formato de fecha ISO para comparación
  const todayISO = today.toISOString().split('T')[0];
  const futureISO = futureDate.toISOString().split('T')[0];
  
  // 1. Pólizas próximas a vencer (30 días)
  const { data: upcomingPolicies } = await supabase
    .from('policies')
    .select(`
      *,
      clients!inner (
        id,
        name,
        email,
        phone,
        broker_id
      )
    `)
    .eq('status', 'ACTIVA')
    .not('renewal_date', 'is', null)
    .gte('renewal_date', todayISO)
    .lte('renewal_date', futureISO);
    
  // 2. Pólizas vencidas (notificación semanal)
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);
  const weekAgoISO = weekAgo.toISOString().split('T')[0];
  
  const { data: expiredPolicies } = await supabase
    .from('policies')
    .select(`
      *,
      clients!inner (
        id,
        name,
        email,
        phone,
        broker_id
      )
    `)
    .eq('status', 'ACTIVA')
    .not('renewal_date', 'is', null)
    .lt('renewal_date', todayISO)
    .gte('renewal_date', weekAgoISO);
  
  // Log de notificaciones (por ahora solo registramos)
  const notifications = {
    upcoming: upcomingPolicies?.length || 0,
    expired: expiredPolicies?.length || 0,
    timestamp: new Date().toISOString(),
  };
  
  // Registrar en audit_logs
  await supabase.from('audit_logs').insert({
    action: 'RENEWAL_NOTIFICATIONS',
    entity: 'policies',
    meta: {
      ...notifications,
      upcomingPolicies: upcomingPolicies?.map((p: any) => ({
        id: p.id,
        policy_number: p.policy_number,
        renewal_date: p.renewal_date,
        client_name: p.clients?.name,
      })),
      expiredPolicies: expiredPolicies?.map((p: any) => ({
        id: p.id,
        policy_number: p.policy_number,
        renewal_date: p.renewal_date,
        client_name: p.clients?.name,
      })),
    },
  });
  
  return {
    ok: true,
    upcoming: upcomingPolicies?.length || 0,
    expired: expiredPolicies?.length || 0,
  };
}
