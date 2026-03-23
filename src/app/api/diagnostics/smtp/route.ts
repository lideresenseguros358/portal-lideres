/**
 * DIAGNOSTICS ENDPOINT - SMTP Send Test
 * ======================================
 * Envía email de prueba desde portal@ hacia tramites@
 * Verifica que el pipeline SMTP funciona
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTransport } from '@/server/email/mailer';
import { requireCronSecret } from '@/lib/security/api-guard';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const authErr = requireCronSecret(request);
  if (authErr) return authErr;

  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const testSubject = `AUTOTEST SMTP ${timestamp}`;

  try {
    console.log('[DIAGNOSTICS SMTP] Sending test email...');

    const transporter = getTransport('PORTAL');

    const info = await transporter.sendMail({
      from: `"Portal Líderes (Test)" <portal@lideresenseguros.com>`,
      to: 'tramites@lideresenseguros.com',
      subject: testSubject,
      text: `Este es un correo de prueba automatizado del sistema de diagnóstico.\n\nTimestamp: ${timestamp}\n\nEste correo debe ser procesado por IMAP y crear un caso automático.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #010139; margin-bottom: 20px;">🔬 Test SMTP → IMAP</h2>
            <p>Este es un correo de prueba automatizado del sistema de diagnóstico.</p>
            <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #8AAA19; margin: 20px 0;">
              <strong>Timestamp:</strong> ${timestamp}<br>
              <strong>Subject:</strong> ${testSubject}
            </div>
            <p style="color: #666; font-size: 14px;">
              Este correo debe ser procesado por IMAP y crear un caso automático en Pendientes.
            </p>
          </div>
        </div>
      `,
    });

    const duration = Date.now() - startTime;

    console.log('[DIAGNOSTICS SMTP] Email sent:', info.messageId);

    return NextResponse.json({
      success: true,
      timestamp,
      duration,
      smtp: {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      },
      testSubject,
      summary: `✅ Email enviado exitosamente - ID: ${info.messageId}`,
      nextStep: 'Espera 3-5 minutos y ejecuta el test IMAP para verificar que llegó',
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('[DIAGNOSTICS SMTP] Error:', error);

    return NextResponse.json({
      success: false,
      timestamp,
      duration,
      error: error.message || 'Error desconocido',
      summary: `❌ SMTP falló: ${error.message}`,
    }, { status: 500 });
  }
}
