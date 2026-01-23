/**
 * IMAP DEBUG LOGGER - Console Only
 * ==================================
 * Logging simple para autodepuración del flujo IMAP
 * Todos los logs aparecen en Vercel console
 */

export type DebugStage = 
  | 'imap_connect' 
  | 'imap_fetch' 
  | 'imap_dedupe'
  | 'db_insert' 
  | 'ai_classify' 
  | 'broker_detect'
  | 'case_create' 
  | 'case_link'
  | 'ui_query';

export type DebugStatus = 'success' | 'error' | 'warning' | 'info';

interface LogEntry {
  testId?: string;
  messageId?: string;
  inboundEmailId?: string;
  caseId?: string;
  stage: DebugStage;
  status: DebugStatus;
  message: string;
  payload?: any;
  errorDetail?: string;
  durationMs?: number;
}

/**
 * Log a etapa del flujo IMAP (solo console)
 */
export async function logImapDebug(entry: LogEntry): Promise<void> {
  const emoji = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  }[entry.status];

  const logData = {
    testId: entry.testId,
    messageId: entry.messageId,
    inboundEmailId: entry.inboundEmailId,
    caseId: entry.caseId,
    payload: entry.payload,
    error: entry.errorDetail,
  };

  console.log(
    `[IMAP DEBUG ${emoji}] [${entry.stage}] ${entry.message}`,
    JSON.stringify(logData, null, 2)
  );
}

/**
 * Genera ID único para test
 */
export function generateTestId(): string {
  return `AUTOTEST-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
