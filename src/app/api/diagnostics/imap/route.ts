/**
 * DIAGNOSTICS ENDPOINT - IMAP Connection Test
 * ============================================
 * Prueba conexión real a IMAP y lista últimos mensajes
 * NO guarda nada, solo verifica conectividad
 */

import { NextRequest, NextResponse } from 'next/server';
import { createImapConnection } from '@/lib/imap/imapClient';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // Verificar autorización
  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = authHeader?.replace('Bearer ', '') || xCronSecret;

  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let client;
  const startTime = Date.now();

  try {
    // Verificar variables
    if (!process.env.ZOHO_IMAP_USER || !process.env.ZOHO_IMAP_PASS) {
      return NextResponse.json({
        success: false,
        error: 'IMAP credentials not configured',
        duration: Date.now() - startTime,
      }, { status: 500 });
    }

    console.log('[DIAGNOSTICS IMAP] Connecting to IMAP...');
    
    // Conectar
    client = await createImapConnection();
    
    console.log('[DIAGNOSTICS IMAP] Connected successfully');

    // Obtener últimos 5 mensajes (solo headers)
    const mailbox = await client.getMailboxLock('INBOX');
    
    try {
      // Buscar últimos 5 mensajes
      const messages = [];
      
      for await (const msg of client.fetch('1:5', {
        envelope: true,
        uid: true,
      })) {
        messages.push({
          uid: msg.uid,
          messageId: msg.envelope?.messageId || 'unknown',
          subject: msg.envelope?.subject || 'Sin asunto',
          from: msg.envelope?.from?.[0]?.address || 'unknown',
          date: msg.envelope?.date?.toISOString() || 'unknown',
        });
      }

      mailbox.release();

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        duration,
        connection: {
          host: process.env.ZOHO_IMAP_HOST,
          port: process.env.ZOHO_IMAP_PORT,
          user: process.env.ZOHO_IMAP_USER,
        },
        messages: {
          count: messages.length,
          latest: messages,
        },
        summary: `✅ IMAP conectado - ${messages.length} mensajes listados en ${duration}ms`,
      });
    } finally {
      mailbox.release();
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('[DIAGNOSTICS IMAP] Error:', error);

    // Detectar tipo de error
    let errorType = 'unknown';
    let errorDetail = error.message || 'Error desconocido';

    if (error.message?.includes('authentication')) {
      errorType = 'auth_failed';
      errorDetail = 'Credenciales inválidas o app password incorrecto';
    } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      errorType = 'timeout';
      errorDetail = 'Timeout - Firewall o conexión bloqueada';
    } else if (error.message?.includes('ECONNREFUSED')) {
      errorType = 'connection_refused';
      errorDetail = 'Conexión rechazada - Host/puerto incorrectos';
    } else if (error.message?.includes('certificate') || error.message?.includes('TLS')) {
      errorType = 'tls_error';
      errorDetail = 'Error de certificado TLS';
    }

    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      duration,
      errorType,
      error: errorDetail,
      summary: `❌ IMAP falló: ${errorType} - ${errorDetail}`,
    }, { status: 500 });
  } finally {
    if (client) {
      try {
        await client.logout();
      } catch (e) {
        // Ignore logout errors
      }
    }
  }
}
