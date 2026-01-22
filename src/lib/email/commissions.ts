/**
 * HELPERS DE CORREOS PARA MÓDULO COMISIONES
 * ==========================================
 * Funciones para enviar correos desde el módulo de Comisiones
 * SMTP: portal@lideresenseguros.com
 */

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';
import { generateDedupeKey } from '@/server/email/dedupe';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Notificar pago de quincena
 */
export async function notifyFortnightPaid(fortnightId: string): Promise<void> {
  const { data: fortnight, error } = await supabase
    .from('fortnights')
    .select('*, brokers!inner(name, email)')
    .eq('id', fortnightId)
    .single();

  if (error || !fortnight) {
    console.error('[COMMISSIONS] Error fetching fortnight:', error);
    return;
  }

  const broker = fortnight.brokers as any;

  // Obtener items de la quincena
  const { count: itemCount } = await supabase
    .from('comm_items')
    .select('id', { count: 'exact', head: true })
    .eq('fortnight_id', fortnightId);

  const html = renderEmailTemplate('commissionPaid', {
    brokerName: broker.name,
    fortnightName: `Quincena ${fortnight.fortnight_number}`,
    startDate: fortnight.start_date,
    endDate: fortnight.end_date,
    totalAmount: fortnight.total_amount || 0,
    paidDate: fortnight.paid_date || new Date().toISOString(),
    itemCount: itemCount || 0,
    totalPremium: fortnight.total_premium || 0,
    avgPercentage: fortnight.avg_percentage || 0,
    portalUrl: appUrl,
  });

  await sendEmail({
    to: broker.email,
    subject: `💰 Quincena pagada: ${fortnight.fortnight_number}`,
    html,
    fromType: 'PORTAL',
    template: 'commissionPaid',
    dedupeKey: generateDedupeKey(broker.email, 'commissionPaid', fortnightId),
    metadata: { fortnightId, brokerId: fortnight.broker_id },
  });
}

/**
 * Notificar pago de ajuste
 */
export async function notifyAdjustmentPaid(adjustmentData: {
  brokerId: string;
  amount: number;
  type: string;
  concept: string;
  description?: string;
}): Promise<void> {
  const { data: broker } = await supabase
    .from('brokers')
    .select('name, email')
    .eq('id', adjustmentData.brokerId)
    .single();

  if (!broker) {
    console.error('[COMMISSIONS] Broker not found:', adjustmentData.brokerId);
    return;
  }

  const html = renderEmailTemplate('commissionAdjustmentPaid', {
    brokerName: broker.name,
    adjustmentType: adjustmentData.type,
    amount: adjustmentData.amount,
    paidDate: new Date().toISOString(),
    concept: adjustmentData.concept,
    description: adjustmentData.description,
    portalUrl: appUrl,
  });

  await sendEmail({
    to: broker.email,
    subject: `💵 Ajuste de comisión aplicado: $${adjustmentData.amount}`,
    html,
    fromType: 'PORTAL',
    template: 'commissionAdjustmentPaid',
    metadata: { 
      brokerId: adjustmentData.brokerId, 
      amount: adjustmentData.amount,
      type: adjustmentData.type,
    },
  });
}
