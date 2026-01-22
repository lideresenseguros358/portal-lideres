/**
 * LÓGICA DE CORREOS DE RENOVACIONES
 * ==================================
 * Envío automático de recordatorios y confirmaciones de renovación
 */

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';
import { generateDedupeKey } from '@/server/email/dedupe';
import { getNowPanama, addDaysPanama, diffInDays, formatPanama } from '@/lib/timezone/panama';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface RenewalResult {
  processed: number;
  emailsSent: number;
  emailsFailed: number;
  casesCreated?: number;
}

/**
 * Enviar recordatorios de renovación a brokers
 * 30 días antes, 7 días antes, mismo día
 */
export async function sendBrokerRenewalReminders(daysBefore: number): Promise<RenewalResult> {
  const now = getNowPanama();
  const targetDate = addDaysPanama(now.toJSDate(), daysBefore);
  
  // Buscar pólizas que vencen en la fecha objetivo
  const { data: policies, error } = await supabase
    .from('policies')
    .select(`
      id,
      policy_number,
      renewal_date,
      premium,
      ramo,
      client_id,
      broker_id,
      insurer_id,
      clients!inner(name, email),
      brokers!inner(name, email, p_id),
      insurers(name)
    `)
    .eq('status', 'ACTIVA')
    .gte('renewal_date', targetDate.startOf('day').toISO())
    .lte('renewal_date', targetDate.endOf('day').toISO());

  if (error || !policies) {
    console.error('[RENEWALS] Error fetching policies:', error);
    return { processed: 0, emailsSent: 0, emailsFailed: 0 };
  }

  const result: RenewalResult = {
    processed: policies.length,
    emailsSent: 0,
    emailsFailed: 0,
  };

  for (const policy of policies) {
    try {
      const broker = policy.brokers as any;
      const client = policy.clients as any;
      const insurer = policy.insurers as any;

      const html = renderEmailTemplate('renewalReminder', {
        brokerName: broker.name,
        clientName: client.name,
        policyNumber: policy.policy_number,
        renewalDate: formatPanama(policy.renewal_date, 'dd/MM/yyyy'),
        daysRemaining: daysBefore,
        isUrgent: daysBefore <= 7,
        insurerName: insurer?.name || 'N/A',
        ramo: policy.ramo || 'N/A',
        premium: policy.premium || 0,
        portalUrl: appUrl,
      });

      const emailResult = await sendEmail({
        to: broker.email,
        subject: `🔔 Renovación próxima: ${client.name} - ${daysBefore} días`,
        html,
        fromType: 'PORTAL',
        template: 'renewalReminder',
        dedupeKey: generateDedupeKey(broker.email, 'renewalReminder', `${policy.id}-${daysBefore}`),
        metadata: {
          policyId: policy.id,
          brokerId: policy.broker_id,
          daysBefore,
        },
      });

      if (emailResult.success && !emailResult.skipped) {
        result.emailsSent++;
      } else if (emailResult.error) {
        result.emailsFailed++;
      }

    } catch (error) {
      console.error(`[RENEWALS] Error processing policy ${policy.id}:`, error);
      result.emailsFailed++;
    }
  }

  return result;
}

/**
 * Enviar confirmaciones de renovación a masters con CTA
 * Para pólizas vencidas (7 días y 90 días)
 */
export async function sendMasterRenewalConfirmations(daysOverdue: number): Promise<RenewalResult> {
  const now = getNowPanama();
  const targetDate = addDaysPanama(now.toJSDate(), -daysOverdue);
  
  // Buscar pólizas vencidas en la fecha objetivo
  const { data: policies, error } = await supabase
    .from('policies')
    .select(`
      id,
      policy_number,
      renewal_date,
      premium,
      ramo,
      client_id,
      broker_id,
      insurer_id,
      clients!inner(name),
      brokers!inner(name),
      insurers(name)
    `)
    .eq('status', 'ACTIVA')
    .gte('renewal_date', targetDate.startOf('day').toISO())
    .lte('renewal_date', targetDate.endOf('day').toISO());

  if (error || !policies) {
    console.error('[RENEWALS] Error fetching overdue policies:', error);
    return { processed: 0, emailsSent: 0, emailsFailed: 0 };
  }

  // Obtener emails de masters
  const { data: masters } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('role', 'master');

  if (!masters || masters.length === 0) {
    return { processed: 0, emailsSent: 0, emailsFailed: 0 };
  }

  const result: RenewalResult = {
    processed: policies.length,
    emailsSent: 0,
    emailsFailed: 0,
  };

  for (const policy of policies) {
    for (const master of masters) {
      try {
        const broker = policy.brokers as any;
        const client = policy.clients as any;
        const insurer = policy.insurers as any;

        // URL de confirmación (crea caso automáticamente)
        const confirmUrl = `${appUrl}/api/renewals/confirm?policyId=${policy.id}&masterToken=${master.id}`;

        const html = renderEmailTemplate('renewalConfirm', {
          masterName: master.full_name,
          clientName: client.name,
          brokerName: broker.name,
          policyNumber: policy.policy_number,
          renewalDate: formatPanama(policy.renewal_date, 'dd/MM/yyyy'),
          daysOverdue,
          insurerName: insurer?.name || 'N/A',
          ramo: policy.ramo || 'N/A',
          premium: policy.premium || 0,
          confirmUrl,
        });

        const emailResult = await sendEmail({
          to: master.email,
          subject: `⚠️ Renovación vencida: ${client.name} - ${daysOverdue} días`,
          html,
          fromType: 'PORTAL',
          template: 'renewalConfirm',
          dedupeKey: generateDedupeKey(master.email, 'renewalConfirm', `${policy.id}-${daysOverdue}`),
          metadata: {
            policyId: policy.id,
            masterId: master.id,
            daysOverdue,
          },
        });

        if (emailResult.success && !emailResult.skipped) {
          result.emailsSent++;
        } else if (emailResult.error) {
          result.emailsFailed++;
        }

      } catch (error) {
        console.error(`[RENEWALS] Error processing policy ${policy.id} for master ${master.id}:`, error);
        result.emailsFailed++;
      }
    }
  }

  return result;
}
