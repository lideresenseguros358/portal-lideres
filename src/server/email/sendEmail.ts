/**
 * FUNCIÓN CENTRAL DE ENVÍO DE CORREOS
 * ====================================
 * Maneja envío, dedupe, logging y errores
 */

import { createClient } from '@supabase/supabase-js';
import { getTransport, getFromAddress } from './mailer';
import { checkDedupe } from './dedupe';
import { htmlToText } from './renderer';
import type { SendEmailParams, EmailLogRecord } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Enviar correo electrónico
 */
export async function sendEmail(params: SendEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}> {
  const { to, subject, html, text, fromType, dedupeKey, metadata, template } = params;

  console.log('[EMAIL] ========== INICIANDO ENVÍO ==========');
  console.log('[EMAIL] To:', to);
  console.log('[EMAIL] Subject:', subject);
  console.log('[EMAIL] Template:', template || 'N/A');
  console.log('[EMAIL] FromType:', fromType);
  console.log('[EMAIL] DedupeKey:', dedupeKey || 'N/A');

  try {
    // 1. Verificar dedupe
    if (dedupeKey) {
      console.log('[EMAIL] Verificando dedupe...');
      const isDuplicate = await checkDedupe(dedupeKey);
      if (isDuplicate) {
        console.log(`[EMAIL] ⚠️ Correo duplicado omitido: ${dedupeKey}`);
        
        // Registrar como skipped
        await logEmail({
          to: Array.isArray(to) ? to.join(',') : to,
          subject,
          template: template || null,
          dedupe_key: dedupeKey,
          status: 'skipped',
          error: 'Duplicate detected',
          metadata: metadata || {},
        });

        return { success: true, skipped: true };
      }
      console.log('[EMAIL] ✓ No es duplicado, continuando...');
    }

    // 2. Obtener transporte y dirección FROM
    console.log('[EMAIL] Obteniendo transporte SMTP...');
    const transport = getTransport(fromType);
    const from = getFromAddress(fromType);
    console.log('[EMAIL] From:', from);

    // 3. Generar texto plano si no se proporcionó
    console.log('[EMAIL] Generando texto plano...');
    const plainText = text || htmlToText(html);
    console.log('[EMAIL] HTML length:', html.length, 'chars');
    console.log('[EMAIL] Text length:', plainText.length, 'chars');

    // 4. Enviar correo
    console.log('[EMAIL] Enviando correo vía SMTP...');
    const info = await transport.sendMail({
      from,
      to,
      subject,
      html,
      text: plainText,
    });

    console.log(`[EMAIL] ✓ Enviado correctamente`);
    console.log('[EMAIL] MessageId:', info.messageId);
    console.log('[EMAIL] Response:', info.response);

    // 5. Registrar éxito en DB
    console.log('[EMAIL] Registrando en email_logs...');
    await logEmail({
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      template: template || null,
      dedupe_key: dedupeKey || null,
      status: 'sent',
      error: null,
      metadata: {
        messageId: info.messageId,
        fromType,
        ...(metadata || {}),
      },
    });
    console.log('[EMAIL] ✓ Log registrado exitosamente');
    console.log('[EMAIL] ========== ENVÍO COMPLETADO ==========');

    return { success: true, messageId: info.messageId };

  } catch (error: any) {
    console.error('[EMAIL] ✗ ERROR ENVIANDO CORREO');
    console.error('[EMAIL] Error message:', error.message);
    console.error('[EMAIL] Error code:', error.code);
    console.error('[EMAIL] Error command:', error.command);
    console.error('[EMAIL] Error stack:', error.stack);
    console.error('[EMAIL] Full error:', JSON.stringify(error, null, 2));

    // Registrar fallo en DB
    console.log('[EMAIL] Registrando error en email_logs...');
    await logEmail({
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      template: template || null,
      dedupe_key: dedupeKey || null,
      status: 'failed',
      error: error.message || 'Unknown error',
      metadata: {
        errorCode: error.code,
        errorCommand: error.command,
        ...(metadata || {}),
      },
    });
    console.log('[EMAIL] ========== ENVÍO FALLIDO ==========');

    return { success: false, error: error.message };
  }
}

/**
 * Registrar envío en email_logs
 */
async function logEmail(record: Omit<EmailLogRecord, 'id' | 'created_at'>): Promise<void> {
  try {
    const { error } = await supabase.from('email_logs').insert({
      to: record.to,
      subject: record.subject,
      template: record.template,
      dedupe_key: record.dedupe_key,
      status: record.status,
      error: record.error,
      metadata: record.metadata,
    });

    if (error) {
      console.error('[EMAIL] Error registrando log:', error);
    }
  } catch (err) {
    console.error('[EMAIL] Error crítico en logging:', err);
  }
}

/**
 * Enviar correos masivos usando cola con rate-limiting
 * 
 * DEPRECADO: Usa sendEmailQueue directamente para mayor control
 * Esta función se mantiene por compatibilidad pero internamente
 * usa el sistema de cola seguro con rate-limiting.
 * 
 * @deprecated Usar sendEmailQueue de './queue' en su lugar
 */
export async function sendEmailBatch(emails: SendEmailParams[]): Promise<{
  total: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  console.warn('[EMAIL] ⚠️ sendEmailBatch está deprecado, usa sendEmailQueue de ./queue');
  console.log('[EMAIL] Redirigiendo a cola con rate-limiting...');
  
  // Importar dinámicamente para evitar ciclos
  const { sendEmailQueue } = await import('./queue');
  
  const result = await sendEmailQueue(emails);
  
  // Retornar en formato compatible
  return {
    total: result.total,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
  };
}
