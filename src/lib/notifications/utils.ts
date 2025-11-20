/**
 * Notification Utilities
 * Funciones auxiliares para el sistema de notificaciones
 */

import crypto from 'crypto';

export type NotificationType = 'renewal' | 'case_digest' | 'commission' | 'delinquency' | 'download' | 'guide' | 'carnet_renewal' | 'agenda_event' | 'other';

export type NotificationTarget = 'MASTER' | 'BROKER' | 'ALL';

/**
 * Genera un hash único para prevenir notificaciones duplicadas
 * Format: {type}-{entity_id}-{condition}-{YYYY-MM-DD}
 */
export function generateNotificationHash(
  type: NotificationType,
  entityId: string,
  condition?: string
): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const parts = [type, entityId, condition, today].filter(Boolean);
  const baseString = parts.join('-');
  
  // Generar SHA256 hash
  return crypto
    .createHash('sha256')
    .update(baseString)
    .digest('hex');
}

/**
 * Construye deep-links según el tipo de notificación
 */
export function getDeepLink(
  type: NotificationType,
  params: Record<string, string>
): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  switch (type) {
    case 'renewal':
      // Link a la página de clientes con filtro de póliza
      return `${baseUrl}/clientes${params.policy_id ? `?policy=${params.policy_id}` : ''}`;
    
    case 'case_digest':
      // Link a casos filtrados por fecha
      return `${baseUrl}/cases${params.date ? `?date=${params.date}` : ''}`;
    
    case 'commission':
      // Link a comisiones con quincena específica
      return `${baseUrl}/comisiones${params.quincena_id ? `?quincena=${params.quincena_id}` : ''}`;
    
    case 'delinquency':
      // Link a morosidad con filtros
      const delinquencyParams = new URLSearchParams();
      if (params.insurer_id) delinquencyParams.set('insurer', params.insurer_id);
      if (params.date) delinquencyParams.set('date', params.date);
      return `${baseUrl}/morosidad${delinquencyParams.toString() ? `?${delinquencyParams}` : ''}`;
    
    case 'download':
      // Link a descargas con filtros
      const downloadParams = new URLSearchParams();
      if (params.insurer_id) downloadParams.set('insurer', params.insurer_id);
      if (params.doc_id) downloadParams.set('doc', params.doc_id);
      return `${baseUrl}/descargas${downloadParams.toString() ? `?${downloadParams}` : ''}`;
    
    case 'guide':
      // Link a guías con sección y doc
      const guideParams = new URLSearchParams();
      if (params.section) guideParams.set('section', params.section);
      if (params.guide_id) guideParams.set('id', params.guide_id);
      return `${baseUrl}/guias${guideParams.toString() ? `?${guideParams}` : ''}`;
    
    case 'carnet_renewal':
      // Link a cuenta del broker
      return `${baseUrl}/account`;
    
    case 'agenda_event':
      // Link a agenda con evento específico
      return `${baseUrl}/agenda${params.event_id ? `?event=${params.event_id}` : ''}`;
    
    default:
      return baseUrl;
  }
}

/**
 * Resuelve los destinatarios según el contexto
 */
export interface RecipientContext {
  brokerId?: string;
  clientEmail?: string;
  masterNotify?: boolean;
  target: NotificationTarget;
}

export interface ResolvedRecipients {
  to: string[];
  cc: string[];
  brokerIds: string[];
}

export async function resolveRecipients(
  context: RecipientContext,
  supabase: any
): Promise<ResolvedRecipients> {
  const recipients: ResolvedRecipients = {
    to: [],
    cc: [],
    brokerIds: []
  };

  // Si es para un broker específico
  if (context.brokerId) {
    const { data: broker } = await supabase
      .from('profiles')
      .select('email, notify_broker_renewals')
      .eq('id', context.brokerId)
      .single();

    if (broker?.email) {
      recipients.to.push(broker.email);
      recipients.brokerIds.push(context.brokerId);
    }

    // Agregar cliente si existe
    if (context.clientEmail) {
      // Cliente es TO principal, broker va a CC
      recipients.to = [context.clientEmail];
      if (broker?.email) {
        recipients.cc.push(broker.email);
      }
    }

    // Agregar master si tiene el toggle activado
    if (context.masterNotify || broker?.notify_broker_renewals) {
      const { data: masters } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', 'master');

      if (masters && masters.length > 0) {
        masters.forEach((master: any) => {
          if (master.email && !recipients.cc.includes(master.email)) {
            recipients.cc.push(master.email);
          }
        });
      }
    }
  }

  // Si es para ALL
  if (context.target === 'ALL') {
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, email, role')
      .in('role', ['master', 'broker']);

    if (allProfiles && allProfiles.length > 0) {
      allProfiles.forEach((profile: any) => {
        if (profile.email) {
          recipients.to.push(profile.email);
          if (profile.role === 'broker') {
            recipients.brokerIds.push(profile.id);
          }
        }
      });
    }
  }

  // Si es solo para MASTER
  if (context.target === 'MASTER') {
    const { data: masters } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'master');

    if (masters && masters.length > 0) {
      masters.forEach((master: any) => {
        if (master.email) {
          recipients.to.push(master.email);
        }
      });
    }
  }

  return recipients;
}
