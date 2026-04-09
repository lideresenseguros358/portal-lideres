/**
 * IMAP INGESTOR - Coordinador Principal
 * ======================================
 * Orquesta el proceso completo de ingestión:
 * 1. Conectar a IMAP
 * 2. Fetch mensajes en ventana de tiempo
 * 3. Deduplicar por message-id
 * 4. Guardar en inbound_emails + attachments
 * 5. Clasificar con Vertex AI
 * 6. Crear/vincular caso con Case Engine
 * 7. Actualizar estado de procesamiento
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  createImapConnection,
  fetchMessagesInWindow,
  closeImapConnection,
  type EmailMessage,
} from './imapClient';
import { getZohoImapConfigTramites } from '@/lib/email/zohoImapConfigTramites';
import { classifyInboundEmail } from '@/lib/vertex/vertexClient';
import { classifyPendientesEmail } from '@/lib/vertex/pendientesClassifier';
import { saveAiClassification, applyStatusIfConfident } from '@/lib/vertex/pendientesAiPersistence';
import { processInboundEmail } from '@/lib/cases/caseEngine';
import { logImapDebug } from '@/lib/debug/imapLogger';

export interface IngestionResult {
  success: boolean;
  messagesProcessed: number;
  casesCreated: number;
  casesLinked: number;
  messagesIgnored: number;
  errors: Array<{ messageId: string; error: string }>;
}

// ════════════════════════════════════════════
// PRE-FILTRO DETERMINÍSTICO DE RUIDO
// ════════════════════════════════════════════

interface IgnoreCheckInput {
  subject: string;
  bodyText: string | null;
  fromEmail: string;
}

interface IgnoreCheckResult {
  ignore: boolean;
  reason: string;
}

/**
 * Detecta correos de ruido operacional sin llamar a Vertex AI.
 * Categorías: cortesías, respuestas a notificaciones del portal,
 * acuses automáticos, delivery notifications, out-of-office.
 *
 * Devuelve ignore=true + reason si el correo debe descartarse.
 * El ingestor lo guarda en DB con processed_status='ignored' para deduplicar.
 */
function shouldIgnoreEmail(input: IgnoreCheckInput): IgnoreCheckResult {
  const subject = (input.subject || '').trim();
  const subjectLower = subject.toLowerCase();
  const from = (input.fromEmail || '').toLowerCase();

  // 1. Remitentes de sistema (no-reply, mailer-daemon, postmaster)
  if (/no-?reply|noreply|mailer-daemon|postmaster|bounce\+|do-?not-?reply/i.test(from)) {
    return { ignore: true, reason: 'NO_REPLY_SENDER' };
  }

  // 2. Notificaciones de entrega fallida / bounce
  if (/delivery status notification|mail delivery subsystem|undeliverable|delivery failure|returned mail|bounced message/i.test(subjectLower)) {
    return { ignore: true, reason: 'DELIVERY_BOUNCE' };
  }

  // 3. Fuera de oficina / auto-reply
  if (/out of office|fuera de oficina|auto-?reply|respuesta autom[aá]tica|autorespuesta|automatic reply/i.test(subjectLower)) {
    return { ignore: true, reason: 'AUTO_REPLY' };
  }

  // 4. Respuestas a notificaciones automáticas del portal
  //    Condición: subject empieza con "Re:" Y contiene palabra clave de notificación portal
  const isReply = /^re\s*:/i.test(subject);
  if (isReply) {
    const PORTAL_NOTIFICATION_PATTERNS = [
      /comisi[oó]n(es)?\s+recibidas?/i,
      /nueva\s+quincena/i,
      /liquidaci[oó]n\s+(de\s+)?quincena/i,
      /pago\s+de\s+comisiones?/i,
      /resumen\s+de\s+comisiones?/i,
      /recordatorio\s+(de\s+)?agenda/i,
      /invitaci[oó]n\s+.*evento/i,
      /confirmaci[oó]n\s+de\s+asistencia/i,
      /rsvp/i,
      /evento\s+.*portal/i,
      /notificaci[oó]n\s+.*portal/i,
    ];
    if (PORTAL_NOTIFICATION_PATTERNS.some(p => p.test(subjectLower))) {
      return { ignore: true, reason: 'PORTAL_NOTIFICATION_REPLY' };
    }
  }

  // 5. Respuestas de cortesía muy cortas (cuerpo sin citas < 80 chars)
  const rawBody = (input.bodyText || '').trim();
  if (rawBody) {
    // Quitar líneas de cita (>, >>) y encabezados de respuesta
    const bodyWithoutQuotes = rawBody
      .split('\n')
      .filter(line => !/^\s*>/.test(line))         // quitar líneas de cita
      .filter(line => !/^-{3,}/.test(line))         // quitar separadores
      .filter(line => !/^(de|from|date|fecha|asunto|subject):/i.test(line.trim()))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (bodyWithoutQuotes.length > 0 && bodyWithoutQuotes.length < 80) {
      const COURTESY_PHRASES = [
        /^(muchas\s+)?gracias[.!]?$/i,
        /^ok[.!]?$/i,
        /^recibido[.!]?$/i,
        /^entendido[.!]?$/i,
        /^perfecto[.!]?$/i,
        /^listo[.!]?$/i,
        /^de\s+nada[.!]?$/i,
        /^con\s+gusto[.!]?$/i,
        /^claro[.!]?$/i,
        /^muy\s+bien[.!]?$/i,
        /^excelente[.!]?$/i,
        /^gracias[,.]?\s+(saludos|buen\s+d[ií]a|hasta\s+luego|que\s+est[eé]s?\s+bien)[.!]?$/i,
        /^(muchas\s+)?gracias[,.]?\s+[^.]{0,40}[.!]?$/i,
        /^ok[,.]?\s*(gracias|recibido)[.!]?$/i,
        /^recibido[,.]?\s*(gracias|ok)[.!]?$/i,
      ];
      if (COURTESY_PHRASES.some(p => p.test(bodyWithoutQuotes))) {
        return { ignore: true, reason: 'COURTESY_REPLY' };
      }
    }
  }

  return { ignore: false, reason: '' };
}

/**
 * Ejecuta ciclo de ingestión completo
 */
export async function runIngestionCycle(): Promise<IngestionResult> {
  const result: IngestionResult = {
    success: true,
    messagesProcessed: 0,
    casesCreated: 0,
    casesLinked: 0,
    messagesIgnored: 0,
    errors: [],
  };

  // Feature flag check
  if (process.env.FEATURE_ENABLE_IMAP !== 'true') {
    console.log('[INGESTOR] IMAP ingestion disabled by feature flag');
    return result;
  }

  const windowMinutes = Number(process.env.IMAP_POLL_WINDOW_MINUTES) || 60;
  const maxMessages = Number(process.env.IMAP_MAX_MESSAGES_PER_RUN) || 20;
  const folder = process.env.IMAP_DEFAULT_FOLDER || 'INBOX';

  let client;

  try {
    console.log('[INGESTOR] Starting ingestion cycle');
    console.log(`[INGESTOR] Window: ${windowMinutes} min, Max: ${maxMessages} messages`);

    await logImapDebug({
      stage: 'imap_connect',
      status: 'info',
      message: 'Iniciando ciclo de ingestion',
      payload: { windowMinutes, maxMessages, folder },
    });

    // 1. Conectar a IMAP (tramites@lideresenseguros.com)
    const imapConfig = getZohoImapConfigTramites();
    client = await createImapConnection(imapConfig);
    console.log('[INGESTOR] IMAP connection established (tramites@)');

    await logImapDebug({
      stage: 'imap_connect',
      status: 'success',
      message: 'Conexión IMAP establecida',
    });

    // 2. Fetch mensajes
    const messages = await fetchMessagesInWindow(
      client,
      windowMinutes,
      maxMessages,
      folder
    );

    console.log(`[INGESTOR] Fetched ${messages.length} messages from IMAP`);

    await logImapDebug({
      stage: 'imap_fetch',
      status: messages.length > 0 ? 'success' : 'info',
      message: `IMAP fetch: ${messages.length} mensajes encontrados`,
      payload: { 
        messagesCount: messages.length,
        messageIds: messages.map(m => m.messageId),
      },
    });

    // 3. Procesar cada mensaje
    for (const msg of messages) {
      try {
        const processed = await processMessage(msg);
        
        result.messagesProcessed++;
        
        if (processed.action === 'created' || processed.action === 'provisional') {
          result.casesCreated++;
        } else if (processed.action === 'linked') {
          result.casesLinked++;
        } else if (processed.action === 'ignored') {
          result.messagesIgnored++;
        }
      } catch (err: any) {
        console.error(`[INGESTOR] Error processing message ${msg.messageId}:`, err);
        result.errors.push({
          messageId: msg.messageId,
          error: err.message || 'Unknown error',
        });
      }
    }

    console.log('[INGESTOR] Ingestion cycle completed');
    console.log(`[INGESTOR] Processed: ${result.messagesProcessed}, Created: ${result.casesCreated}, Linked: ${result.casesLinked}, Ignored: ${result.messagesIgnored}, Errors: ${result.errors.length}`);
  } catch (err: any) {
    console.error('[INGESTOR] Fatal error in ingestion cycle:', err);
    result.success = false;
    result.errors.push({
      messageId: 'SYSTEM',
      error: err.message || 'Fatal error',
    });
  } finally {
    // Siempre cerrar conexión IMAP
    if (client) {
      await closeImapConnection(client);
      console.log('[INGESTOR] IMAP connection closed');
    }
  }

  return result;
}

/**
 * Procesa un mensaje individual
 */
async function processMessage(msg: EmailMessage): Promise<any> {
  const supabase = getSupabaseAdmin();

  // 1. Deduplicar por message-id
  // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
  const { data: existing } = await supabase
    .from('inbound_emails')
    .select('id')
    .eq('message_id', msg.messageId)
    .single();

  if (existing) {
    console.log(`[INGESTOR] Message ${msg.messageId} already exists, skipping`);
    await logImapDebug({
      messageId: msg.messageId,
      stage: 'imap_dedupe',
      status: 'info',
      message: 'Mensaje ya existe - deduplicado',
    });
    return { action: 'skipped' };
  }

  // 1b. Pre-filtro determinístico — evalúa ANTES de llamar a Vertex AI (ahorra tokens)
  //     Si el correo es ruido operacional, se guarda con processed_status='ignored'
  //     para garantizar deduplicación en el próximo ciclo.
  const ignoreCheck = shouldIgnoreEmail({
    subject: msg.subject,
    bodyText: msg.bodyTextNormalized,
    fromEmail: msg.from?.email || '',
  });

  if (ignoreCheck.ignore) {
    // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
    await supabase.from('inbound_emails').insert({
      message_id: msg.messageId,
      from_email: msg.from?.email || null,
      from_name: msg.from?.name || null,
      to_emails: msg.to.map(t => t.email),
      cc_emails: msg.cc.map(c => c.email),
      subject: msg.subject,
      subject_normalized: msg.subjectNormalized,
      date_sent: msg.dateSent.toISOString(),
      in_reply_to: msg.inReplyTo,
      thread_references: msg.threadReferences,
      body_text: msg.bodyText,
      body_html: null,
      body_text_normalized: msg.bodyTextNormalized,
      attachments_count: msg.attachments.length,
      attachments_total_bytes: msg.attachments.reduce((sum, a) => sum + a.sizeBytes, 0),
      imap_uid: msg.imapUid,
      folder: msg.folder,
      processed_status: 'ignored',
      processed_at: new Date().toISOString(),
      error_code: ignoreCheck.reason,
      error_detail: `Pre-filtro determinístico: ${ignoreCheck.reason}`,
    });
    console.log(`[INGESTOR] Pre-filtro: ignorado (${ignoreCheck.reason}) — ${msg.messageId}`);
    return { action: 'ignored' };
  }

  // 2. Guardar en inbound_emails
  // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
  const { data: inboundEmail, error: saveError } = await supabase
    .from('inbound_emails')
    .insert({
      message_id: msg.messageId,
      from_email: msg.from?.email || null,
      from_name: msg.from?.name || null,
      to_emails: msg.to.map(t => t.email),
      cc_emails: msg.cc.map(c => c.email),
      subject: msg.subject,
      subject_normalized: msg.subjectNormalized,
      date_sent: msg.dateSent.toISOString(),
      in_reply_to: msg.inReplyTo,
      thread_references: msg.threadReferences,
      body_text: msg.bodyText,
      body_html: msg.bodyHtml,
      body_text_normalized: msg.bodyTextNormalized,
      attachments_count: msg.attachments.length,
      attachments_total_bytes: msg.attachments.reduce((sum, a) => sum + a.sizeBytes, 0),
      imap_uid: msg.imapUid,
      folder: msg.folder,
      processed_status: 'new',
    })
    .select()
    .single();

  if (saveError || !inboundEmail) {
    throw new Error(`Error saving email: ${saveError?.message}`);
  }

  console.log(`[INGESTOR] Saved inbound_email ${inboundEmail.id}`);

  await logImapDebug({
    messageId: msg.messageId,
    inboundEmailId: inboundEmail.id,
    stage: 'db_insert',
    status: 'success',
    message: 'Email guardado en inbound_emails',
    payload: {
      inbound_email_id: inboundEmail.id,
      from: msg.from?.email,
      subject: msg.subject,
    },
  });

  // 3. Guardar attachments (si hay)
  // TODO: Implementar guardado en Supabase Storage si es necesario
  // Por ahora solo metadata

  // 4. Clasificar con Vertex AI (enhanced Pendientes classifier)
  const pendAi = await classifyPendientesEmail({
    subject: msg.subject,
    body_text: msg.bodyTextNormalized,
    from_email: msg.from?.email || '',
    cc_emails: msg.cc.map(c => c.email),
    attachments_summary: msg.attachments.map(a => `${a.filename} (${a.sizeBytes} bytes)`).join(', '),
  });

  console.log(`[INGESTOR] Pend AI: type=${pendAi.case_type} ramo=${pendAi.ramo} aseg=${pendAi.aseguradora} ticket_req=${pendAi.ticket_required} conf=${pendAi.confidence} ignore=${pendAi.should_ignore}`);

  // 4b. Chequeo post-AI: si Vertex detectó ruido semántico, ignorar sin crear caso
  if (pendAi.should_ignore) {
    // @ts-ignore - tabla nueva
    await supabase
      .from('inbound_emails')
      .update({
        processed_status: 'ignored',
        processed_at: new Date().toISOString(),
        error_code: pendAi.ignore_reason || 'AI_IGNORED',
        error_detail: `AI-filtro: ${pendAi.rationale || pendAi.ignore_reason}`,
      })
      .eq('id', inboundEmail.id);
    console.log(`[INGESTOR] AI-filtro: ignorado (${pendAi.ignore_reason}) — ${msg.messageId}`);
    return { action: 'ignored' };
  }

  // Build base classifier result for backward compatibility with caseEngine
  const aiResult = await classifyInboundEmail({
    subject: msg.subject,
    body_text_normalized: msg.bodyTextNormalized,
    from: msg.from?.email || '',
    cc: msg.cc.map(c => c.email),
    attachments_summary: msg.attachments.map(a => `${a.filename} (${a.sizeBytes} bytes)`).join(', '),
  });

  // Merge enhanced fields into base result
  if (pendAi.confidence > 0) {
    aiResult.ramo_bucket = pendAi.ramo_bucket;
    aiResult.confidence = pendAi.confidence;
    aiResult.broker_email_detected = pendAi.broker_email_detected || aiResult.broker_email_detected;
  }

  await logImapDebug({
    messageId: msg.messageId,
    inboundEmailId: inboundEmail.id,
    stage: 'ai_classify',
    status: 'success',
    message: 'Clasificación AI completada (enhanced)',
    payload: {
      ramo_bucket: aiResult.ramo_bucket,
      confidence: aiResult.confidence,
      pend_case_type: pendAi.case_type,
      pend_ramo: pendAi.ramo,
      pend_aseguradora: pendAi.aseguradora,
      ticket_required: pendAi.ticket_required,
      ticket_exception: pendAi.ticket_exception_reason,
      suggested_status: pendAi.suggested_status,
      status_confidence: pendAi.status_confidence,
      policy_number: pendAi.policy_number,
      attachments_detected: pendAi.attachments.detected,
      attachments_missing: pendAi.attachments.missing_expected,
    },
  });

  // 5. Crear/vincular caso (pass enhanced classification for ticket exceptions)
  const caseResult = await processInboundEmail({
    inboundEmailId: inboundEmail.id,
    aiClassification: aiResult,
    emailFrom: msg.from?.email || '',
    emailCc: msg.cc.map(c => c.email),
    emailSubject: msg.subject,
    emailSubjectNormalized: msg.subjectNormalized,
    inReplyTo: msg.inReplyTo,
    threadReferences: msg.threadReferences,
    pendientesClassification: pendAi,
  });

  // 5b. Save enhanced AI classification to pend_ai_classifications
  const classId = await saveAiClassification({
    caseId: caseResult.caseId || null,
    messageId: msg.messageId,
    result: pendAi,
  });

  // 5c. Auto-apply status if confidence >= 0.80 and case was created
  if (caseResult.caseId && classId && pendAi.status_confidence >= 0.80) {
    const autoResult = await applyStatusIfConfident(caseResult.caseId, classId, pendAi);
    if (autoResult.applied) {
      console.log(`[INGESTOR] Auto-applied status '${autoResult.newStatus}' to case ${caseResult.caseId}`);
    }
  }

  // 6. Actualizar estado de inbound_email
  const newStatus = caseResult.success ? 'linked' : 'error';
  
  // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
  await supabase
    .from('inbound_emails')
    .update({
      processed_status: newStatus,
      processed_at: new Date().toISOString(),
      error_code: caseResult.success ? null : 'CASE_CREATION_FAILED',
      error_detail: caseResult.success ? null : caseResult.message,
    })
    .eq('id', inboundEmail.id);

  console.log(`[INGESTOR] Email ${inboundEmail.id} processed: ${caseResult.action}`);

  await logImapDebug({
    messageId: msg.messageId,
    inboundEmailId: inboundEmail.id,
    caseId: caseResult.caseId,
    stage: 'case_create',
    status: caseResult.success ? 'success' : 'error',
    message: caseResult.message,
    payload: {
      action: caseResult.action,
      case_id: caseResult.caseId,
      ticket: caseResult.ticket,
    },
    errorDetail: caseResult.success ? undefined : caseResult.message,
  });

  return caseResult;
}
