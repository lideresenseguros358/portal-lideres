import { getSupabaseAdmin, Tables } from '../supabase/admin';
import { createNotification } from './create';
import { getTodayLocalDate, getFutureDateLocal, getPastDateLocal } from '../utils/dates';
import { sendNotificationEmail } from './send-email';

type Policy = Tables<'policies'>;
type Client = Tables<'clients'>;

interface RenewalNotificationOptions {
  daysBefore?: number;
}

interface PolicyWithClient extends Policy {
  clients: Client;
}

/**
 * Sistema de Renovaciones - Alertas Escalonadas
 * 
 * 30 días antes: Recordatorio de renovación próxima (Broker)
 * 7 días antes: Recordatorio urgente (Broker)
 * Día de vencimiento: Advertencia de eliminación en 60 días (Broker)
 * 60 días post-vencimiento: Eliminación automática (Broker + Master)
 */
export async function runRenewalNotifications(options: RenewalNotificationOptions = {}) {
  const { daysBefore = 30 } = options;
  const supabase = await getSupabaseAdmin();
  
  const todayISO = getTodayLocalDate();
  
  let results = {
    alert_30d: 0,
    alert_7d: 0,
    alert_0d: 0,
    alert_60d_deleted: 0,
    brokers_notified: 0,
  };
  
  // Ejecutar según el parámetro daysBefore
  if (daysBefore === 30) {
    results = await run30DaysAlert(supabase, todayISO!);
  } else if (daysBefore === 7) {
    results = await run7DaysAlert(supabase, todayISO!);
  } else if (daysBefore === 0) {
    results = await run0DaysAlert(supabase, todayISO!);
  } else if (daysBefore === -60) {
    results = await run60DaysPostExpiration(supabase, todayISO!);
  }
  
  // Log en audit_logs
  await supabase.from('audit_logs').insert({
    action: 'RENEWAL_NOTIFICATIONS',
    entity: 'policies',
    meta: {
      ...results,
      days_before: daysBefore,
      timestamp: new Date().toISOString(),
    },
  });
  
  return { ok: true, ...results };
}

/**
 * Alerta 30 días antes del vencimiento
 */
async function run30DaysAlert(supabase: any, todayISO: string) {
  const futureISO = getFutureDateLocal(30);
  
  // Pólizas que vencen en exactamente 30 días
  const { data: policies } = await supabase
    .from('policies')
    .select(`
      *,
      clients!inner (
        id,
        name,
        email,
        phone,
        broker_id,
        brokers (
          id,
          name,
          p_id,
          profiles (
            email,
            notify_broker_renewals
          )
        )
      ),
      insurers (
        id,
        name
      )
    `)
    .eq('status', 'ACTIVA')
    .eq('renewal_date', futureISO);
  
  if (!policies || policies.length === 0) {
    return { alert_30d: 0, alert_7d: 0, alert_0d: 0, alert_60d_deleted: 0, brokers_notified: 0 };
  }
  
  // Agrupar por broker
  const brokerPoliciesMap = groupPoliciesByBroker(policies);
  
  // Notificar a cada broker
  for (const [brokerId, brokerPolicies] of brokerPoliciesMap.entries()) {
    try {
      await notifyBrokerRenewal(supabase, brokerId, brokerPolicies, '30d');
    } catch (error) {
      console.error(`Error notificando broker ${brokerId}:`, error);
    }
  }
  
  return {
    alert_30d: policies.length,
    alert_7d: 0,
    alert_0d: 0,
    alert_60d_deleted: 0,
    brokers_notified: brokerPoliciesMap.size,
  };
}

/**
 * Alerta 7 días antes del vencimiento
 */
async function run7DaysAlert(supabase: any, todayISO: string) {
  const futureISO = getFutureDateLocal(7);
  
  const { data: policies } = await supabase
    .from('policies')
    .select(`
      *,
      clients!inner (
        id,
        name,
        email,
        phone,
        broker_id,
        brokers (
          id,
          name,
          p_id,
          profiles (
            email,
            notify_broker_renewals
          )
        )
      ),
      insurers (
        id,
        name
      )
    `)
    .eq('status', 'ACTIVA')
    .eq('renewal_date', futureISO);
  
  if (!policies || policies.length === 0) {
    return { alert_30d: 0, alert_7d: 0, alert_0d: 0, alert_60d_deleted: 0, brokers_notified: 0 };
  }
  
  const brokerPoliciesMap = groupPoliciesByBroker(policies);
  
  for (const [brokerId, brokerPolicies] of brokerPoliciesMap.entries()) {
    try {
      await notifyBrokerRenewal(supabase, brokerId, brokerPolicies, '7d');
    } catch (error) {
      console.error(`Error notificando broker ${brokerId}:`, error);
    }
  }
  
  return {
    alert_30d: 0,
    alert_7d: policies.length,
    alert_0d: 0,
    alert_60d_deleted: 0,
    brokers_notified: brokerPoliciesMap.size,
  };
}

/**
 * Alerta día de vencimiento
 */
async function run0DaysAlert(supabase: any, todayISO: string) {
  const { data: policies } = await supabase
    .from('policies')
    .select(`
      *,
      clients!inner (
        id,
        name,
        email,
        phone,
        broker_id,
        brokers (
          id,
          name,
          p_id,
          profiles (
            email,
            notify_broker_renewals
          )
        )
      ),
      insurers (
        id,
        name
      )
    `)
    .eq('status', 'ACTIVA')
    .eq('renewal_date', todayISO);
  
  if (!policies || policies.length === 0) {
    return { alert_30d: 0, alert_7d: 0, alert_0d: 0, alert_60d_deleted: 0, brokers_notified: 0 };
  }
  
  const brokerPoliciesMap = groupPoliciesByBroker(policies);
  
  for (const [brokerId, brokerPolicies] of brokerPoliciesMap.entries()) {
    try {
      await notifyBrokerRenewal(supabase, brokerId, brokerPolicies, '0d');
    } catch (error) {
      console.error(`Error notificando broker ${brokerId}:`, error);
    }
  }
  
  return {
    alert_30d: 0,
    alert_7d: 0,
    alert_0d: policies.length,
    alert_60d_deleted: 0,
    brokers_notified: brokerPoliciesMap.size,
  };
}

/**
 * Eliminación automática 60 días post-vencimiento
 */
async function run60DaysPostExpiration(supabase: any, todayISO: string) {
  const sixtyDaysAgoISO = getPastDateLocal(60);
  
  // Pólizas vencidas hace exactamente 60 días
  const { data: policies } = await supabase
    .from('policies')
    .select(`
      *,
      clients!inner (
        id,
        name,
        email,
        phone,
        broker_id,
        brokers (
          id,
          name,
          p_id,
          profiles (
            email,
            notify_broker_renewals
          )
        )
      ),
      insurers (
        id,
        name
      )
    `)
    .eq('status', 'ACTIVA')
    .eq('renewal_date', sixtyDaysAgoISO);
  
  if (!policies || policies.length === 0) {
    return { alert_30d: 0, alert_7d: 0, alert_0d: 0, alert_60d_deleted: 0, brokers_notified: 0 };
  }
  
  const brokerPoliciesMap = groupPoliciesByBroker(policies);
  
  // Notificar antes de eliminar
  for (const [brokerId, brokerPolicies] of brokerPoliciesMap.entries()) {
    try {
      await notifyBrokerRenewal(supabase, brokerId, brokerPolicies, '60d-delete');
    } catch (error) {
      console.error(`Error notificando broker ${brokerId}:`, error);
    }
  }
  
  // Eliminar clientes
  const clientIds = [...new Set(policies.map((p: any) => p.clients.id))];
  
  for (const clientId of clientIds) {
    try {
      // Soft delete: marcar como inactivo en lugar de eliminar
      await supabase
        .from('clients')
        .update({ 
          status: 'INACTIVO',
          notes: `Cliente eliminado automáticamente el ${todayISO} por renovación vencida hace 60 días`
        })
        .eq('id', clientId);
      
      // Marcar pólizas como inactivas
      await supabase
        .from('policies')
        .update({ status: 'CANCELADA' })
        .eq('client_id', clientId);
    } catch (error) {
      console.error(`Error eliminando cliente ${clientId}:`, error);
    }
  }
  
  return {
    alert_30d: 0,
    alert_7d: 0,
    alert_0d: 0,
    alert_60d_deleted: clientIds.length,
    brokers_notified: brokerPoliciesMap.size,
  };
}

/**
 * Agrupar pólizas por broker
 */
function groupPoliciesByBroker(policies: any[]): Map<string, any[]> {
  const map = new Map<string, any[]>();
  
  for (const policy of policies) {
    const brokerId = policy.clients?.broker_id;
    if (!brokerId) continue;
    
    if (!map.has(brokerId)) {
      map.set(brokerId, []);
    }
    map.get(brokerId)!.push(policy);
  }
  
  return map;
}

/**
 * Notificar a broker sobre renovaciones
 */
async function notifyBrokerRenewal(
  supabase: any,
  brokerId: string,
  policies: any[],
  alertType: '30d' | '7d' | '0d' | '60d-delete'
) {
  // Obtener info del broker
  const broker = policies[0]?.clients?.brokers;
  if (!broker) return;
  
  const brokerProfile = broker.profiles;
  const brokerName = broker.name || 'Broker';
  const brokerEmail = brokerProfile?.email;
  const notifyBrokerRenewals = brokerProfile?.notify_broker_renewals;
  
  if (!brokerEmail) return;
  
  // Determinar si notificar a master
  const shouldNotifyMaster = alertType === '60d-delete' || notifyBrokerRenewals;
  
  // Títulos y mensajes según tipo de alerta
  const alerts = {
    '30d': {
      title: `🔔 Renovación Próxima: ${policies.length} póliza${policies.length > 1 ? 's' : ''}`,
      body: `${policies.length} póliza${policies.length > 1 ? 's' : ''} de tus clientes vence${policies.length > 1 ? 'n' : ''} en 30 días`,
      urgency: 'normal' as const,
    },
    '7d': {
      title: `⚠️ URGENTE: Renovación en 7 Días - ${policies.length} póliza${policies.length > 1 ? 's' : ''}`,
      body: `¡Quedan solo 7 días! Actualiza la fecha de renovación`,
      urgency: 'high' as const,
    },
    '0d': {
      title: `🚨 ÚLTIMA ADVERTENCIA: ${policies.length} Póliza${policies.length > 1 ? 's' : ''} Vencida${policies.length > 1 ? 's' : ''} Hoy`,
      body: `Las pólizas vencieron hoy. Si no actualizas en 60 días, los clientes serán eliminados automáticamente`,
      urgency: 'critical' as const,
    },
    '60d-delete': {
      title: `❌ Cliente${policies.length > 1 ? 's' : ''} Eliminado${policies.length > 1 ? 's' : ''} por Vencimiento`,
      body: `${policies.length} cliente${policies.length > 1 ? 's fueron' : ' fue'} eliminado${policies.length > 1 ? 's' : ''} automáticamente tras 60 días sin renovación`,
      urgency: 'critical' as const,
    },
  };
  
  const alert = alerts[alertType];
  
  // Crear notificación para el broker
  const notificationData = {
    type: 'renewal' as const,
    target: 'BROKER' as const,
    title: alert.title,
    body: alert.body,
    brokerId: broker.p_id,
    meta: {
      alert_type: alertType,
      urgency: alert.urgency,
      policies_count: policies.length,
      policies: policies.map((p: any) => ({
        policy_number: p.policy_number,
        client_name: p.clients?.name,
        renewal_date: p.renewal_date,
        insurer_name: p.insurers?.name,
      })),
    },
    entityId: `renewal-${alertType}-${brokerId}-${policies[0].renewal_date}`,
  };
  
  const notifResult = await createNotification(notificationData);
  
  // Enviar email
  if (notifResult.success && !notifResult.isDuplicate) {
    await sendNotificationEmail({
      type: 'renewal',
      to: brokerEmail,
      data: {
        brokerName,
        alertType,
        urgency: alert.urgency,
        policies: policies.map((p: any) => ({
          policyNumber: p.policy_number,
          clientName: p.clients?.name,
          renewalDate: p.renewal_date,
          insurerName: p.insurers?.name,
          clientId: p.clients?.id,
        })),
      },
      notificationId: notifResult.notificationId,
    });
  }
  
  // Notificar a master si aplica
  if (shouldNotifyMaster) {
    const { data: masters } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'master');
    
    if (masters && masters.length > 0) {
      for (const master of masters) {
        if (!master.email) continue;
        
        const masterNotifData = {
          type: 'renewal' as const,
          target: 'MASTER' as const,
          title: `[MASTER] ${alert.title} - Broker: ${brokerName}`,
          body: alert.body,
          meta: {
            alert_type: alertType,
            urgency: alert.urgency,
            broker_id: brokerId,
            broker_name: brokerName,
            policies_count: policies.length,
          },
          entityId: `renewal-master-${alertType}-${brokerId}-${policies[0].renewal_date}`,
        };
        
        const masterNotifResult = await createNotification(masterNotifData);
        
        if (masterNotifResult.success && !masterNotifResult.isDuplicate) {
          await sendNotificationEmail({
            type: 'renewal',
            to: master.email,
            data: {
              brokerName: `${brokerName} (gestionado por ti)`,
              alertType,
              urgency: alert.urgency,
              policies: policies.map((p: any) => ({
                policyNumber: p.policy_number,
                clientName: p.clients?.name,
                renewalDate: p.renewal_date,
                insurerName: p.insurers?.name,
                clientId: p.clients?.id,
              })),
            },
            notificationId: masterNotifResult.notificationId,
          });
        }
      }
    }
  }
}
