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

import { createClient } from '@/lib/supabase/server';
import {
  createImapConnection,
  fetchMessagesInWindow,
  closeImapConnection,
  type EmailMessage,
} from './imapClient';
import { classifyInboundEmail } from '@/lib/vertex/vertexClient';
import { processInboundEmail } from '@/lib/cases/caseEngine';

export interface IngestionResult {
  success: boolean;
  messagesProcessed: number;
  casesCreated: number;
  casesLinked: number;
  errors: Array<{ messageId: string; error: string }>;
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

    // 1. Conectar a IMAP
    client = await createImapConnection();
    console.log('[INGESTOR] IMAP connection established');

    // 2. Fetch mensajes
    const messages = await fetchMessagesInWindow(
      client,
      windowMinutes,
      maxMessages,
      folder
    );

    console.log(`[INGESTOR] Fetched ${messages.length} messages from IMAP`);

    // 3. Procesar cada mensaje
    for (const msg of messages) {
      try {
        const processed = await processMessage(msg);
        
        result.messagesProcessed++;
        
        if (processed.action === 'created' || processed.action === 'provisional') {
          result.casesCreated++;
        } else if (processed.action === 'linked') {
          result.casesLinked++;
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
    console.log(`[INGESTOR] Processed: ${result.messagesProcessed}, Created: ${result.casesCreated}, Linked: ${result.casesLinked}, Errors: ${result.errors.length}`);
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
  const supabase = await createClient();

  // 1. Deduplicar por message-id
  // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
  const { data: existing } = await supabase
    .from('inbound_emails')
    .select('id')
    .eq('message_id', msg.messageId)
    .single();

  if (existing) {
    console.log(`[INGESTOR] Message ${msg.messageId} already exists, skipping`);
    return { action: 'skipped' };
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

  // 3. Guardar attachments (si hay)
  // TODO: Implementar guardado en Supabase Storage si es necesario
  // Por ahora solo metadata

  // 4. Clasificar con Vertex AI
  const aiResult = await classifyInboundEmail({
    subject: msg.subject,
    body_text_normalized: msg.bodyTextNormalized,
    from: msg.from?.email || '',
    cc: msg.cc.map(c => c.email),
    attachments_summary: msg.attachments.map(a => `${a.filename} (${a.sizeBytes} bytes)`).join(', '),
  });

  console.log(`[INGESTOR] AI classification: bucket=${aiResult.ramo_bucket}, confidence=${aiResult.confidence}`);

  // 5. Crear/vincular caso
  const caseResult = await processInboundEmail({
    inboundEmailId: inboundEmail.id,
    aiClassification: aiResult,
    emailFrom: msg.from?.email || '',
    emailCc: msg.cc.map(c => c.email),
    emailSubject: msg.subject,
  });

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

  return caseResult;
}
