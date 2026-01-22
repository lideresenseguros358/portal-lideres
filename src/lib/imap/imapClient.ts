/**
 * IMAP CLIENT - Zoho Mail
 * ========================
 * Cliente IMAP para conexión segura con Zoho Mail
 * usando imapflow (Node.js stream-based IMAP client)
 * 
 * Features:
 * - Conexión segura TLS/SSL
 * - Búsqueda por ventana de tiempo
 * - Descarga de headers, body y attachments
 * - Deduplicación por Message-ID
 * - Normalización de contenido para AI
 */

import { ImapFlow } from 'imapflow';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailMessage {
  messageId: string;
  from: { email: string; name?: string } | null;
  to: Array<{ email: string; name?: string }>;
  cc: Array<{ email: string; name?: string }>;
  subject: string;
  subjectNormalized: string;
  dateSent: Date;
  inReplyTo: string | null;
  threadReferences: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  bodyTextNormalized: string | null;
  attachments: EmailAttachment[];
  imapUid: string;
  folder: string;
}

export interface EmailAttachment {
  filename: string;
  mimetype: string;
  sizeBytes: number;
  content: Buffer;
  sha256?: string;
}

/**
 * Crea conexión IMAP a Zoho
 */
export async function createImapConnection(): Promise<ImapFlow> {
  const config: ImapConfig = {
    host: process.env.ZOHO_IMAP_HOST || 'imap.zoho.com',
    port: Number(process.env.ZOHO_IMAP_PORT) || 993,
    secure: true,
    auth: {
      user: process.env.ZOHO_IMAP_USER || '',
      pass: process.env.ZOHO_IMAP_PASS || '',
    },
  };

  if (!config.auth.user || !config.auth.pass) {
    throw new Error('IMAP credentials not configured');
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    logger: false, // Disable logging en producción (evitar secrets)
  });

  await client.connect();
  return client;
}

/**
 * Obtiene mensajes de IMAP en ventana de tiempo
 */
export async function fetchMessagesInWindow(
  client: ImapFlow,
  windowMinutes: number,
  maxMessages: number,
  folder = 'INBOX'
): Promise<EmailMessage[]> {
  await client.mailboxOpen(folder);

  // Calcular ventana de tiempo
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  console.log(`[IMAP] Fetching messages since ${windowStart.toISOString()}`);

  // Buscar mensajes desde windowStart
  const searchCriteria = {
    since: windowStart,
  };

  // Buscar UIDs
  const uids = await client.search(searchCriteria);
  
  if (uids.length === 0) {
    console.log('[IMAP] No messages found in window');
    return [];
  }

  console.log(`[IMAP] Found ${uids.length} messages, limiting to ${maxMessages}`);

  // Limitar cantidad
  const limitedUids = uids.slice(0, maxMessages);

  const messages: EmailMessage[] = [];

  // Fetch messages por chunks
  for await (const msg of client.fetch(limitedUids, {
    envelope: true,
    bodyStructure: true,
    source: true, // Full message source
    uid: true,
  })) {
    try {
      const parsed = await parseMessage(msg, folder);
      if (parsed) {
        messages.push(parsed);
      }
    } catch (err) {
      console.error(`[IMAP] Error parsing message UID ${msg.uid}:`, err);
    }
  }

  return messages;
}

/**
 * Parsea un mensaje IMAP a EmailMessage
 */
async function parseMessage(
  msg: any,
  folder: string
): Promise<EmailMessage | null> {
  const envelope = msg.envelope;
  if (!envelope) return null;

  // Message-ID
  const messageId = envelope.messageId || `generated-${msg.uid}-${Date.now()}`;

  // From
  const from = envelope.from?.[0]
    ? {
        email: envelope.from[0].address || '',
        name: envelope.from[0].name || undefined,
      }
    : null;

  // To
  const to = envelope.to?.map((addr: any) => ({
    email: addr.address || '',
    name: addr.name || undefined,
  })) || [];

  // CC
  const cc = envelope.cc?.map((addr: any) => ({
    email: addr.address || '',
    name: addr.name || undefined,
  })) || [];

  // Subject
  const subject = envelope.subject || '';
  const subjectNormalized = normalizeSubject(subject);

  // Date
  const dateSent = envelope.date || new Date();

  // Threading
  const inReplyTo = envelope.inReplyTo || null;
  const threadReferences = envelope.references?.join(' ') || null;

  // Body parsing (simple text extraction)
  let bodyText: string | null = null;
  let bodyHtml: string | null = null;

  try {
    const simpleParser = await import('mailparser').then(m => m.simpleParser);
    const parsed = await simpleParser(msg.source);
    
    bodyText = parsed.text || null;
    bodyHtml = parsed.html || null;
  } catch (err) {
    console.error('[IMAP] Error parsing body:', err);
  }

  // Normalize body for AI
  const bodyTextNormalized = normalizeBodyText(bodyText);

  // Attachments (simplificado - solo metadata por ahora)
  const attachments: EmailAttachment[] = [];
  
  // TODO: Parse attachments from bodyStructure if needed
  // Por ahora solo metadata básica

  return {
    messageId,
    from,
    to,
    cc,
    subject,
    subjectNormalized,
    dateSent,
    inReplyTo,
    threadReferences,
    bodyText,
    bodyHtml,
    bodyTextNormalized,
    attachments,
    imapUid: msg.uid.toString(),
    folder,
  };
}

/**
 * Normaliza subject: quita Re:, Fwd:, etc
 */
function normalizeSubject(subject: string): string {
  if (!subject) return '(sin asunto)';
  
  return subject
    .replace(/^(re:|fwd?:|fw:)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || '(sin asunto)';
}

/**
 * Normaliza body text para AI:
 * - Quita firmas largas
 * - Recorta hilos
 * - Limita longitud
 */
function normalizeBodyText(text: string | null): string | null {
  if (!text) return null;

  let normalized = text;

  // Quitar firmas comunes
  const signaturePatterns = [
    /sent from my iphone/gi,
    /enviado desde mi iphone/gi,
    /get outlook for ios/gi,
    /get outlook for android/gi,
    /--\s*$/gm, // Signature separator
  ];

  signaturePatterns.forEach(pattern => {
    normalized = normalized.replace(pattern, '');
  });

  // Recortar hilos (líneas con > al inicio)
  const lines = normalized.split('\n');
  const nonQuotedLines = lines.filter(line => !line.trim().startsWith('>'));
  
  // Si hay líneas sin quote, usar solo esas (primer mensaje del thread)
  if (nonQuotedLines.length > 0) {
    normalized = nonQuotedLines.join('\n');
  }

  // Limitar longitud (primeros 3000 chars para AI)
  normalized = normalized.substring(0, 3000);

  // Limpiar espacios múltiples
  normalized = normalized.replace(/\n{3,}/g, '\n\n').trim();

  return normalized || null;
}

/**
 * Cierra conexión IMAP de manera segura
 */
export async function closeImapConnection(client: ImapFlow): Promise<void> {
  try {
    await client.logout();
  } catch (err) {
    console.error('[IMAP] Error closing connection:', err);
  }
}
