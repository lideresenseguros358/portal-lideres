/**
 * ZOHO IMAP SYNC — Renovaciones
 * ===============================
 * 1. Connect to Zoho IMAP (ZOHO_IMAP_USER_PORTAL / ZOHO_IMAP_PASS_PORTAL)
 * 2. Fetch new emails since last checkpoint
 * 3. Parse headers + body
 * 4. Store in ops_case_messages (idempotent by message_id)
 * 5. Thread by ticket (REN-YYMM-XXXXX) or policy_number
 * 6. Mark unclassified if no match
 * 7. Log everything (no secrets)
 */

import { ImapFlow } from 'imapflow';
import { getZohoImapConfig } from './zohoImapConfig';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ── Types ──

export interface SyncResult {
  success: boolean;
  count_new_messages: number;
  count_classified: number;
  count_unclassified: number;
  count_skipped_duplicate: number;
  errors: string[];
  duration_ms: number;
}

interface ParsedEmail {
  messageId: string;
  inReplyTo: string | null;
  references: string | null;
  fromEmail: string;
  toEmails: string[];
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: Date;
  hasAttachments: boolean;
  uid: number;
}

// ── Ticket regex: REN-YYMM-XXXXX ──
const TICKET_RE = /REN-\d{4}-\d{5}/i;

// ── Policy number regex: flexible alphanumeric patterns ──
// Matches patterns like: 12345678, ABC-12345, POL-2024-001, etc.
const POLICY_RE = /\b([A-Z]{0,4}-?\d{4,12}(?:-\d{1,6})?)\b/gi;

// ════════════════════════════════════════════
// MAIN RUN FUNCTION
// ════════════════════════════════════════════

export async function run(): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = {
    success: true,
    count_new_messages: 0,
    count_classified: 0,
    count_unclassified: 0,
    count_skipped_duplicate: 0,
    errors: [],
    duration_ms: 0,
  };

  let client: ImapFlow | null = null;

  try {
    const config = getZohoImapConfig();
    console.log('[IMAP-SYNC] ═══════════════════════════════════');
    console.log('[IMAP-SYNC] Starting sync cycle');
    console.log('[IMAP-SYNC] User:', config.auth.user);

    // 1. Connect
    client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      logger: false,
    });

    await client.connect();
    console.log('[IMAP-SYNC] Connected to IMAP');

    // 2. Get checkpoint
    const supabase = getSupabaseAdmin();
    const checkpoint = await getCheckpoint(supabase);
    console.log('[IMAP-SYNC] Checkpoint:', JSON.stringify(checkpoint));

    // 3. Open INBOX
    const mailbox = await client.getMailboxLock('INBOX');

    try {
      // 4. Search for messages since checkpoint
      const searchDate = checkpoint.last_synced_at
        ? new Date(new Date(checkpoint.last_synced_at).getTime() - 5 * 60 * 1000) // 5 min buffer
        : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24h

      console.log(`[IMAP-SYNC] Searching since: ${searchDate.toISOString()}`);

      const uids = await client.search({ since: searchDate });
      console.log(`[IMAP-SYNC] Found ${uids.length} UIDs`);

      if (uids.length === 0) {
        console.log('[IMAP-SYNC] No new messages');
        await updateCheckpoint(supabase, checkpoint.last_uid);
        result.duration_ms = Date.now() - start;
        return result;
      }

      // 5. Fetch and process each message
      const maxPerRun = 50;
      const limitedUids = uids.slice(-maxPerRun); // Take the latest N

      for await (const msg of client.fetch(limitedUids, {
        envelope: true,
        source: true,
        uid: true,
        bodyStructure: true,
      })) {
        try {
          const parsed = await parseImapMessage(msg);
          if (!parsed) continue;

          // Deduplicate by message_id
          const exists = await messageExists(supabase, parsed.messageId);
          if (exists) {
            result.count_skipped_duplicate++;
            continue;
          }

          // Thread the message
          const threading = await threadMessage(supabase, parsed);

          // Insert into ops_case_messages
          const { error: insertErr } = await (supabase as any)
            .from('ops_case_messages')
            .insert({
              case_id: threading.caseId,
              unclassified: threading.unclassified,
              direction: 'inbound',
              provider: 'zoho_imap',
              message_id: parsed.messageId,
              in_reply_to: parsed.inReplyTo,
              references: parsed.references,
              from_email: parsed.fromEmail,
              to_emails: parsed.toEmails,
              subject: parsed.subject,
              body_text: parsed.bodyText,
              body_html: parsed.bodyHtml,
              received_at: parsed.receivedAt.toISOString(),
              metadata: {
                imap_uid: parsed.uid,
                has_attachments: parsed.hasAttachments,
                threading_method: threading.method,
              },
            });

          if (insertErr) {
            console.error('[IMAP-SYNC] Insert error:', insertErr.message);
            result.errors.push(`Insert failed for ${parsed.messageId}: ${insertErr.message}`);
            continue;
          }

          result.count_new_messages++;
          if (threading.unclassified) {
            result.count_unclassified++;
          } else {
            result.count_classified++;
          }

          // Log activity
          await logImapActivity(supabase, threading, parsed);

          // Track highest UID
          if (parsed.uid > checkpoint.last_uid) {
            checkpoint.last_uid = parsed.uid;
          }
        } catch (msgErr: any) {
          console.error(`[IMAP-SYNC] Error processing UID ${msg.uid}:`, msgErr.message);
          result.errors.push(`UID ${msg.uid}: ${msgErr.message}`);
        }
      }

      // 6. Update checkpoint
      await updateCheckpoint(supabase, checkpoint.last_uid);

    } finally {
      mailbox.release();
    }

    console.log(`[IMAP-SYNC] Cycle complete: new=${result.count_new_messages} classified=${result.count_classified} unclassified=${result.count_unclassified} dupes=${result.count_skipped_duplicate}`);
  } catch (err: any) {
    console.error('[IMAP-SYNC] Fatal error:', err.message);
    result.success = false;
    result.errors.push(err.message);
  } finally {
    if (client) {
      try { await client.logout(); } catch { /* ignore */ }
    }
    result.duration_ms = Date.now() - start;
  }

  return result;
}

// ════════════════════════════════════════════
// PARSE IMAP MESSAGE
// ════════════════════════════════════════════

async function parseImapMessage(msg: any): Promise<ParsedEmail | null> {
  const envelope = msg.envelope;
  if (!envelope) return null;

  const messageId = envelope.messageId || `gen-${msg.uid}-${Date.now()}`;
  const fromEmail = envelope.from?.[0]?.address || '';
  const toEmails = (envelope.to || []).map((a: any) => a.address || '').filter(Boolean);
  const subject = envelope.subject || '';
  const receivedAt = envelope.date || new Date();
  const inReplyTo = envelope.inReplyTo || null;
  const references = Array.isArray(envelope.references)
    ? envelope.references.join(' ')
    : envelope.references || null;

  // Parse body
  let bodyText: string | null = null;
  let bodyHtml: string | null = null;
  let hasAttachments = false;

  if (msg.source) {
    try {
      const { simpleParser } = await import('mailparser');
      const parsed = await simpleParser(msg.source);
      bodyText = parsed.text || null;
      bodyHtml = typeof parsed.html === 'string' ? parsed.html : null;
      hasAttachments = (parsed.attachments?.length || 0) > 0;
    } catch (parseErr: any) {
      console.error(`[IMAP-SYNC] Body parse error UID ${msg.uid}:`, parseErr.message);
    }
  }

  return {
    messageId,
    inReplyTo,
    references,
    fromEmail,
    toEmails,
    subject,
    bodyText,
    bodyHtml,
    receivedAt: receivedAt instanceof Date ? receivedAt : new Date(receivedAt),
    hasAttachments,
    uid: msg.uid,
  };
}

// ════════════════════════════════════════════
// THREADING LOGIC
// ════════════════════════════════════════════

interface ThreadingResult {
  caseId: string | null;
  unclassified: boolean;
  method: 'ticket' | 'policy' | 'unclassified';
  ticket?: string;
  policyNumber?: string;
}

async function threadMessage(supabase: any, email: ParsedEmail): Promise<ThreadingResult> {
  const searchText = `${email.subject} ${email.bodyText || ''}`;

  // ── STEP A: Match by ticket (REN-YYMM-XXXXX) ──
  const ticketMatch = searchText.match(TICKET_RE);
  if (ticketMatch) {
    const ticket = ticketMatch[0].toUpperCase();
    console.log(`[IMAP-SYNC] Ticket found in email: ${ticket}`);

    const { data: caseRow } = await (supabase as any)
      .from('ops_cases')
      .select('id')
      .eq('ticket', ticket)
      .eq('case_type', 'renovacion')
      .single();

    if (caseRow) {
      console.log(`[IMAP-SYNC] ✓ Classified by ticket ${ticket} → case ${caseRow.id}`);
      return {
        caseId: caseRow.id,
        unclassified: false,
        method: 'ticket',
        ticket,
      };
    }
    console.log(`[IMAP-SYNC] Ticket ${ticket} found in text but no matching case`);
  }

  // ── STEP B: Match by policy_number ──
  const policyMatches = extractPolicyNumbers(searchText);
  if (policyMatches.length > 0) {
    console.log(`[IMAP-SYNC] Potential policy numbers: ${policyMatches.join(', ')}`);

    // Try each candidate against open renovation cases
    for (const pn of policyMatches) {
      const { data: caseRow } = await (supabase as any)
        .from('ops_cases')
        .select('id, ticket')
        .eq('case_type', 'renovacion')
        .eq('policy_number', pn)
        .not('status', 'in', '("cerrado_renovado","cerrado_cancelado")')
        .limit(1)
        .single();

      if (caseRow) {
        console.log(`[IMAP-SYNC] ✓ Classified by policy ${pn} → case ${caseRow.id}`);
        return {
          caseId: caseRow.id,
          unclassified: false,
          method: 'policy',
          policyNumber: pn,
          ticket: caseRow.ticket,
        };
      }
    }
  }

  // ── STEP C: Unclassified ──
  console.log(`[IMAP-SYNC] ⚠ No match — marking as unclassified`);
  return {
    caseId: null,
    unclassified: true,
    method: 'unclassified',
  };
}

/**
 * Extract potential policy numbers from text.
 * Filters out common false positives (years, short numbers).
 */
function extractPolicyNumbers(text: string): string[] {
  const matches = text.match(POLICY_RE) || [];
  // Filter: must have at least 5 digits, not be a pure year like 2024/2025
  return [...new Set(matches)].filter((m) => {
    const digits = m.replace(/\D/g, '');
    if (digits.length < 5) return false;
    if (/^20\d{2}$/.test(digits)) return false; // Just a year
    return true;
  });
}

// ════════════════════════════════════════════
// CHECKPOINT
// ════════════════════════════════════════════

interface Checkpoint {
  last_uid: number;
  last_synced_at: string | null;
}

async function getCheckpoint(supabase: any): Promise<Checkpoint> {
  const { data } = await (supabase as any)
    .from('ops_config')
    .select('value')
    .eq('key', 'imap_sync_checkpoint')
    .single();

  if (data?.value) {
    return {
      last_uid: data.value.last_uid || 0,
      last_synced_at: data.value.last_synced_at || null,
    };
  }

  return { last_uid: 0, last_synced_at: null };
}

async function updateCheckpoint(supabase: any, lastUid: number): Promise<void> {
  const now = new Date().toISOString();
  await (supabase as any)
    .from('ops_config')
    .update({
      value: { last_uid: lastUid, last_synced_at: now },
      updated_at: now,
    })
    .eq('key', 'imap_sync_checkpoint');

  console.log(`[IMAP-SYNC] Checkpoint updated: uid=${lastUid} at=${now}`);
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

async function messageExists(supabase: any, messageId: string): Promise<boolean> {
  const { data } = await (supabase as any)
    .from('ops_case_messages')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle();

  return !!data;
}

async function logImapActivity(
  supabase: any,
  threading: ThreadingResult,
  email: ParsedEmail,
): Promise<void> {
  let actionType: string;
  switch (threading.method) {
    case 'ticket':
      actionType = 'imap_classified_by_ticket';
      break;
    case 'policy':
      actionType = 'imap_classified_by_policy';
      break;
    default:
      actionType = 'imap_left_unclassified';
  }

  try {
    await (supabase as any).from('ops_activity_log').insert({
      user_id: null,
      action_type: actionType,
      entity_type: 'email',
      entity_id: threading.caseId || null,
      metadata: {
        message_id: email.messageId,
        from_email: email.fromEmail,
        subject: email.subject.substring(0, 200),
        ticket: threading.ticket || null,
        policy_number: threading.policyNumber || null,
        method: threading.method,
      },
    });
  } catch (logErr: any) {
    console.error('[IMAP-SYNC] Activity log error:', logErr.message);
  }
}
