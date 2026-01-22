/**
 * LÓGICA DE CORREOS DE CUMPLEAÑOS
 * ================================
 * Envío automático de felicitaciones y recordatorios
 */

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';
import { generateDedupeKey } from '@/server/email/dedupe';
import { getNowPanama, isToday, formatPanama } from '@/lib/timezone/panama';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BirthdayResult {
  clientBirthdays: number;
  brokerBirthdays: number;
  emailsSent: number;
  emailsFailed: number;
}

/**
 * Notificar a brokers sobre cumpleaños de sus clientes
 */
export async function sendClientBirthdayNotifications(): Promise<BirthdayResult> {
  const now = getNowPanama();
  const todayMM = now.toFormat('MM');
  const todayDD = now.toFormat('dd');

  // Buscar clientes que cumplen años hoy
  // Asumiendo que birth_date está en formato ISO o podemos extraer mes/día
  const { data: clients, error } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      email,
      phone,
      birth_date,
      broker_id,
      brokers!inner(name, email)
    `)
    .not('birth_date', 'is', null)
    .not('broker_id', 'is', null);

  if (error || !clients) {
    console.error('[BIRTHDAYS] Error fetching clients:', error);
    return { clientBirthdays: 0, brokerBirthdays: 0, emailsSent: 0, emailsFailed: 0 };
  }

  // Filtrar clientes que cumplen años hoy
  const birthdayClients = clients.filter(client => {
    if (!client.birth_date) return false;
    const birthDate = new Date(client.birth_date);
    const birthMM = String(birthDate.getMonth() + 1).padStart(2, '0');
    const birthDD = String(birthDate.getDate()).padStart(2, '0');
    return birthMM === todayMM && birthDD === todayDD;
  });

  const result: BirthdayResult = {
    clientBirthdays: birthdayClients.length,
    brokerBirthdays: 0,
    emailsSent: 0,
    emailsFailed: 0,
  };

  // Agrupar por broker
  const clientsByBroker = new Map<string, any[]>();
  for (const client of birthdayClients) {
    const brokerId = client.broker_id;
    if (!clientsByBroker.has(brokerId)) {
      clientsByBroker.set(brokerId, []);
    }
    clientsByBroker.get(brokerId)!.push(client);
  }

  // Enviar un correo por cliente a su broker
  for (const [brokerId, brokerClients] of clientsByBroker) {
    for (const client of brokerClients) {
      try {
        const broker = client.brokers as any;

        // Contar pólizas activas del cliente
        const { count: activePolicies } = await supabase
          .from('policies')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('status', 'ACTIVA');

        const html = renderEmailTemplate('birthdayClient', {
          brokerName: broker.name,
          clientName: client.name,
          clientId: client.id,
          clientEmail: client.email || 'N/A',
          clientPhone: client.phone || 'N/A',
          activePolicies: activePolicies || 0,
          isToday: true,
          birthdayDate: formatPanama(client.birth_date, 'dd/MM'),
          portalUrl: appUrl,
        });

        const emailResult = await sendEmail({
          to: broker.email,
          subject: `🎂 Cumpleaños de cliente: ${client.name}`,
          html,
          fromType: 'PORTAL',
          template: 'birthdayClient',
          dedupeKey: generateDedupeKey(broker.email, 'birthdayClient', `${client.id}-${now.toFormat('yyyy-MM-dd')}`),
          metadata: {
            clientId: client.id,
            brokerId: client.broker_id,
            birthDate: client.birth_date,
          },
        });

        if (emailResult.success && !emailResult.skipped) {
          result.emailsSent++;
        } else if (emailResult.error) {
          result.emailsFailed++;
        }

      } catch (error) {
        console.error(`[BIRTHDAYS] Error processing client ${client.id}:`, error);
        result.emailsFailed++;
      }
    }
  }

  return result;
}

/**
 * Enviar felicitaciones a brokers que cumplen años
 */
export async function sendBrokerBirthdayGreetings(): Promise<BirthdayResult> {
  const now = getNowPanama();
  const todayMM = now.toFormat('MM');
  const todayDD = now.toFormat('dd');

  // Buscar brokers que cumplen años hoy
  const { data: brokers, error } = await supabase
    .from('brokers')
    .select(`
      id,
      name,
      email,
      birth_date
    `)
    .not('birth_date', 'is', null);

  if (error || !brokers) {
    console.error('[BIRTHDAYS] Error fetching brokers:', error);
    return { clientBirthdays: 0, brokerBirthdays: 0, emailsSent: 0, emailsFailed: 0 };
  }

  // Filtrar brokers que cumplen años hoy
  const birthdayBrokers = brokers.filter(broker => {
    if (!broker.birth_date) return false;
    const birthDate = new Date(broker.birth_date);
    const birthMM = String(birthDate.getMonth() + 1).padStart(2, '0');
    const birthDD = String(birthDate.getDate()).padStart(2, '0');
    return birthMM === todayMM && birthDD === todayDD;
  });

  const result: BirthdayResult = {
    clientBirthdays: 0,
    brokerBirthdays: birthdayBrokers.length,
    emailsSent: 0,
    emailsFailed: 0,
  };

  for (const broker of birthdayBrokers) {
    try {
      const html = renderEmailTemplate('birthdayBroker', {
        brokerName: broker.name,
        portalUrl: appUrl,
      });

      const emailResult = await sendEmail({
        to: broker.email,
        subject: '🎉 ¡Feliz Cumpleaños!',
        html,
        fromType: 'PORTAL',
        template: 'birthdayBroker',
        dedupeKey: generateDedupeKey(broker.email, 'birthdayBroker', now.toFormat('yyyy-MM-dd')),
        metadata: {
          brokerId: broker.id,
          birthDate: broker.birth_date,
        },
      });

      if (emailResult.success && !emailResult.skipped) {
        result.emailsSent++;
      } else if (emailResult.error) {
        result.emailsFailed++;
      }

    } catch (error) {
      console.error(`[BIRTHDAYS] Error processing broker ${broker.id}:`, error);
      result.emailsFailed++;
    }
  }

  return result;
}
