/**
 * SISTEMA DE COLA Y RATE-LIMITING PARA ZEPTO API
 * ================================================
 * Implementa envío serializado con intervalos seguros para ZeptoMail
 * 
 * ZEPTOMAIL API:
 * - Diseñado para envío transaccional masivo
 * - Límites mucho más altos que Zoho (miles/hora)
 * - Soporta envío rápido pero mantenemos serialización por seguridad
 * 
 * CONFIGURACIÓN:
 * - Concurrencia: 1 correo activo a la vez
 * - Intervalo: 3 segundos entre correos (20/min = 1200/hora)
 * - Máximo por lote: 200 correos
 * - Reintentos: 1 vez con 30 seg de espera
 */

import { sendEmail } from './sendEmail';
import type { SendEmailParams } from './types';

// ==================== CONFIGURACIÓN ====================

const RATE_LIMIT_CONFIG = {
  /** Segundos entre cada correo (3s = 20 correos/min = 1200/hora) */
  DELAY_BETWEEN_EMAILS: 3 * 1000, // 3 segundos en milisegundos
  
  /** Máximo de correos por lote */
  MAX_BATCH_SIZE: 200,
  
  /** Delay antes de reintentar si hay error de rate limit */
  RETRY_DELAY: 30 * 1000, // 30 segundos
  
  /** Tiempo de bloqueo si hay error crítico */
  CRITICAL_ERROR_LOCKOUT: 30 * 60 * 1000, // 30 minutos
} as const;

// ==================== DETECCIÓN DE ERRORES ====================

/**
 * Errores que indican rate limiting o quota exceeded
 */
const RATE_LIMIT_ERRORS = [
  'quota exceeded',
  'rate limit',
  'too many requests',
  'temporarily blocked',
  'sending rate',
  '421', // SMTP code: Service not available
  '454', // SMTP code: Temporary authentication failure
];

/**
 * Errores críticos que requieren detener el envío completamente
 */
const CRITICAL_ERRORS = [
  'too many connections',
  'sending blocked',
  'account suspended',
  'authentication failed',
  'invalid credentials',
  '535', // SMTP code: Authentication failed
  '550', // SMTP code: Mailbox unavailable
];

/**
 * Verificar si un error es de rate limiting
 */
function isRateLimitError(error: string): boolean {
  const errorLower = error.toLowerCase();
  return RATE_LIMIT_ERRORS.some(pattern => errorLower.includes(pattern));
}

/**
 * Verificar si un error es crítico
 */
function isCriticalError(error: string): boolean {
  const errorLower = error.toLowerCase();
  return CRITICAL_ERRORS.some(pattern => errorLower.includes(pattern));
}

// ==================== ESTADO DE LA COLA ====================

interface QueueState {
  isLocked: boolean;
  lockReason?: string;
  lockUntil?: Date;
  currentBatch?: string;
}

const queueState: QueueState = {
  isLocked: false,
};

/**
 * Bloquear cola por error crítico
 */
function lockQueue(reason: string, durationMs: number): void {
  queueState.isLocked = true;
  queueState.lockReason = reason;
  queueState.lockUntil = new Date(Date.now() + durationMs);
  
  console.error('[EMAIL-QUEUE] 🔒 COLA BLOQUEADA');
  console.error('[EMAIL-QUEUE] Razón:', reason);
  console.error('[EMAIL-QUEUE] Bloqueado hasta:', queueState.lockUntil.toISOString());
}

/**
 * Desbloquear cola si ya pasó el tiempo
 */
function checkAndUnlockQueue(): boolean {
  if (!queueState.isLocked) return true;
  
  if (queueState.lockUntil && new Date() >= queueState.lockUntil) {
    console.log('[EMAIL-QUEUE] 🔓 Cola desbloqueada automáticamente');
    queueState.isLocked = false;
    queueState.lockReason = undefined;
    queueState.lockUntil = undefined;
    return true;
  }
  
  return false;
}

// ==================== FUNCIONES DE ENVÍO ====================

/**
 * Delay entre correos
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enviar un correo con reintento automático
 */
async function sendEmailWithRetry(
  email: SendEmailParams,
  retryCount: number = 0
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  critical?: boolean;
}> {
  try {
    const result = await sendEmail(email);
    
    if (result.success) {
      return result;
    }
    
    // Si falló, verificar tipo de error
    const errorMessage = result.error || '';
    
    // Error crítico → Abortar inmediatamente
    if (isCriticalError(errorMessage)) {
      console.error('[EMAIL-QUEUE] ⛔ ERROR CRÍTICO DETECTADO:', errorMessage);
      return { ...result, critical: true };
    }
    
    // Error de rate limit → Reintentar UNA vez
    if (isRateLimitError(errorMessage) && retryCount === 0) {
      console.warn('[EMAIL-QUEUE] ⚠️ Rate limit detectado, esperando 60s antes de reintentar...');
      await delay(RATE_LIMIT_CONFIG.RETRY_DELAY);
      
      console.log('[EMAIL-QUEUE] 🔄 Reintentando envío...');
      return await sendEmailWithRetry(email, retryCount + 1);
    }
    
    // Cualquier otro error o ya reintentó → Retornar fallo
    return result;
    
  } catch (error: any) {
    console.error('[EMAIL-QUEUE] ❌ Excepción inesperada:', error.message);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

// ==================== FUNCIÓN PRINCIPAL ====================

export interface EmailQueueResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  aborted: boolean;
  abortReason?: string;
  processingTime: number;
}

/**
 * Enviar correos en cola con rate-limiting seguro
 * 
 * FLUJO:
 * 1. Verificar que cola no esté bloqueada
 * 2. Limitar tamaño de lote a MAX_BATCH_SIZE
 * 3. Enviar 1 correo a la vez
 * 4. Esperar DELAY_BETWEEN_EMAILS entre cada uno
 * 5. Reintentar automáticamente si hay rate limit
 * 6. Abortar si hay error crítico
 */
export async function sendEmailQueue(emails: SendEmailParams[]): Promise<EmailQueueResult> {
  const startTime = Date.now();
  const batchId = `BATCH-${Date.now()}`;
  
  console.log('[EMAIL-QUEUE] ========== INICIANDO COLA ==========');
  console.log('[EMAIL-QUEUE] Batch ID:', batchId);
  console.log('[EMAIL-QUEUE] Total correos:', emails.length);
  
  // Verificar si cola está bloqueada
  if (!checkAndUnlockQueue()) {
    console.error('[EMAIL-QUEUE] ⛔ Cola bloqueada, no se puede procesar');
    console.error('[EMAIL-QUEUE] Razón:', queueState.lockReason);
    console.error('[EMAIL-QUEUE] Desbloqueado en:', queueState.lockUntil?.toISOString());
    
    return {
      total: emails.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      aborted: true,
      abortReason: `Cola bloqueada: ${queueState.lockReason}`,
      processingTime: Date.now() - startTime,
    };
  }
  
  // Limitar tamaño de lote
  if (emails.length > RATE_LIMIT_CONFIG.MAX_BATCH_SIZE) {
    console.warn(`[EMAIL-QUEUE] ⚠️ Lote excede límite (${emails.length} > ${RATE_LIMIT_CONFIG.MAX_BATCH_SIZE})`);
    console.warn('[EMAIL-QUEUE] Procesando solo primeros', RATE_LIMIT_CONFIG.MAX_BATCH_SIZE);
    emails = emails.slice(0, RATE_LIMIT_CONFIG.MAX_BATCH_SIZE);
  }
  
  queueState.currentBatch = batchId;
  
  const results: EmailQueueResult = {
    total: emails.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    aborted: false,
    processingTime: 0,
  };
  
  // Procesar cada correo SECUENCIALMENTE
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    if (!email) continue; // Skip si es undefined
    
    const progress = `${i + 1}/${emails.length}`;
    
    console.log(`[EMAIL-QUEUE] ━━━ Correo ${progress} ━━━`);
    console.log('[EMAIL-QUEUE] To:', email.to);
    console.log('[EMAIL-QUEUE] Subject:', email.subject);
    
    // Enviar con reintento
    const result = await sendEmailWithRetry(email);
    
    // Actualizar contadores
    if (result.success && result.skipped) {
      results.skipped++;
      console.log(`[EMAIL-QUEUE] ⏭️ Omitido (duplicado): ${progress}`);
    } else if (result.success) {
      results.sent++;
      console.log(`[EMAIL-QUEUE] ✅ Enviado exitosamente: ${progress}`);
    } else {
      results.failed++;
      console.error(`[EMAIL-QUEUE] ❌ Falló: ${progress}`);
      console.error('[EMAIL-QUEUE] Error:', result.error);
    }
    
    // Si es error crítico → Abortar lote completo
    if (result.critical) {
      console.error('[EMAIL-QUEUE] ⛔ ERROR CRÍTICO - ABORTANDO LOTE');
      lockQueue(result.error || 'Error crítico de SMTP', RATE_LIMIT_CONFIG.CRITICAL_ERROR_LOCKOUT);
      
      results.aborted = true;
      results.abortReason = result.error;
      break;
    }
    
    // Esperar DELAY_BETWEEN_EMAILS antes del siguiente (excepto en el último)
    if (i < emails.length - 1) {
      const delaySec = RATE_LIMIT_CONFIG.DELAY_BETWEEN_EMAILS / 1000;
      console.log(`[EMAIL-QUEUE] ⏳ Esperando ${delaySec}s antes del siguiente...`);
      await delay(RATE_LIMIT_CONFIG.DELAY_BETWEEN_EMAILS);
    }
  }
  
  queueState.currentBatch = undefined;
  results.processingTime = Date.now() - startTime;
  
  console.log('[EMAIL-QUEUE] ========== COLA COMPLETADA ==========');
  console.log('[EMAIL-QUEUE] Enviados:', results.sent);
  console.log('[EMAIL-QUEUE] Fallidos:', results.failed);
  console.log('[EMAIL-QUEUE] Omitidos:', results.skipped);
  console.log('[EMAIL-QUEUE] Abortado:', results.aborted);
  console.log('[EMAIL-QUEUE] Tiempo total:', (results.processingTime / 1000).toFixed(1), 'segundos');
  
  return results;
}

/**
 * Obtener estado actual de la cola
 */
export function getQueueState(): Readonly<QueueState> {
  return { ...queueState };
}

/**
 * Desbloquear cola manualmente (solo para emergencias)
 */
export function unlockQueue(): void {
  if (queueState.isLocked) {
    console.log('[EMAIL-QUEUE] 🔓 Cola desbloqueada manualmente');
    queueState.isLocked = false;
    queueState.lockReason = undefined;
    queueState.lockUntil = undefined;
  }
}
