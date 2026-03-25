/**
 * Admin Commands Parser — Lissa Dynamic Memory
 * ==============================================
 * Detects and processes /aprender, /error, /regla commands.
 *
 * SECURITY: Only the phone number in ADMIN_PHONE_NUMBER env var
 * is allowed to execute commands. Any client sending a /command
 * will have it treated as plain text — no execution, no leakage.
 *
 * Prompt Injection protection: command content is stored verbatim
 * in the DB and injected into the system prompt inside a bounded
 * section clearly labeled as admin-controlled data. The AI is
 * instructed that this section overrides general behavior but is
 * never given the ability to execute code or leak system instructions.
 */

import { insertMemory, type MemoryType } from './lissa-memory';

/** Normalize phone: strip all non-digits */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

const SUPPORTED_COMMANDS = ['/aprender', '/error', '/regla'] as const;
type SupportedCommand = (typeof SUPPORTED_COMMANDS)[number];

const COMMAND_TO_TYPE: Record<SupportedCommand, MemoryType> = {
  '/aprender': 'aprender',
  '/error':    'error',
  '/regla':    'regla',
};

export interface CommandResult {
  /** true if the message was an admin command and was handled */
  handled: boolean;
  /** confirmation reply to send back to admin via WhatsApp */
  reply?: string;
}

/**
 * Attempt to parse and execute an admin command.
 *
 * @param senderPhone - E.164 phone of the sender (e.g. "50768339167")
 * @param messageBody - raw message text from WhatsApp
 * @returns CommandResult — if handled=true, send `reply` and skip AI processing
 */
export async function handleAdminCommand(
  senderPhone: string,
  messageBody: string,
): Promise<CommandResult> {
  const adminPhone = process.env.ADMIN_PHONE_NUMBER || '';

  // Fast-path: if it doesn't start with '/', it's never a command
  const trimmed = messageBody.trim();
  if (!trimmed.startsWith('/')) {
    return { handled: false };
  }

  // Not the admin? Treat '/' message as normal text — never reveal command exists
  if (!adminPhone || normalizePhone(senderPhone) !== normalizePhone(adminPhone)) {
    return { handled: false };
  }

  // Parse command + content
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    // Command with no content
    const cmd = trimmed.toLowerCase() as SupportedCommand;
    if (SUPPORTED_COMMANDS.includes(cmd)) {
      return {
        handled: true,
        reply: `⚠️ Comando "${cmd}" recibido pero sin contenido. Uso: ${cmd} [texto]`,
      };
    }
    return { handled: false };
  }

  const cmd = trimmed.substring(0, spaceIdx).toLowerCase() as SupportedCommand;
  const content = trimmed.substring(spaceIdx + 1).trim();

  if (!SUPPORTED_COMMANDS.includes(cmd)) {
    // Unknown command starting with '/' — only admin is here, give friendly error
    return {
      handled: true,
      reply: `⚠️ Comando desconocido: "${cmd}". Comandos válidos: /aprender, /error, /regla`,
    };
  }

  if (!content) {
    return {
      handled: true,
      reply: `⚠️ El comando "${cmd}" requiere contenido. Uso: ${cmd} [texto]`,
    };
  }

  try {
    const memType = COMMAND_TO_TYPE[cmd];
    await insertMemory(memType, content, senderPhone);

    console.log(`[ADMIN-CMD] Memory inserted — type: ${memType} | by: ${senderPhone} | content: "${content.substring(0, 80)}..."`);

    return {
      handled: true,
      reply: `✅ Memoria actualizada. Categoría: ${memType}.`,
    };
  } catch (err: any) {
    console.error('[ADMIN-CMD] Failed to insert memory:', err.message);
    return {
      handled: true,
      reply: `❌ Error al guardar en memoria: ${err.message}`,
    };
  }
}
