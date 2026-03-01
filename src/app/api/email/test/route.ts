/**
 * POST /api/email/test — Send a simple test email via Zepto API
 * GET  /api/email/test — Check Zepto env status
 *
 * Uses the centralized emailService for sending.
 * Logs result to ops_activity_log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email/emailService';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const TEST_RECIPIENT = 'javiersamudio@lideresenseguros.com';

// ── GET: env status check ──
export async function GET() {
  const status = emailService.getEnvStatus();

  // Temporary production debug log
  console.log('[EMAIL-TEST-GET] Env status:', {
    hasApiKey: status.hasApiKey,
    sender: status.sender,
    vercelEnv: status.vercel_env,
  });

  return NextResponse.json({
    success: true,
    ...status,
  });
}

// ── POST: send test email ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const recipient = body.to || TEST_RECIPIENT;

    console.log('[EMAIL-TEST] ═══════════════════════════════════');
    console.log('[EMAIL-TEST] Sending test email to:', recipient);

    // 1. Validate env first
    const { valid, missing } = emailService.validateEnv();
    if (!valid) {
      const errorMsg = `Missing Zepto configuration in ${process.env.VERCEL_ENV || 'unknown'} environment: ${missing.join(', ')}`;
      console.error('[EMAIL-TEST]', errorMsg);

      return NextResponse.json({
        success: false,
        provider: 'none',
        vercel_env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
        error_code: 'MISSING_ENV_VARS',
        error_message: errorMsg,
        missing_vars: missing,
      }, { status: 500 });
    }

    // 2. Build test email
    const now = new Date();
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
        <div style="background:#010139;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:20px;">✅ Test Email — Portal LISSA</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:0.8;">Enviado via Zepto API</p>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <p style="font-size:14px;color:#374151;">Este es un correo de prueba enviado desde el <strong>Portal Líderes en Seguros</strong>.</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
            <tr>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Proveedor</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;">Zepto API</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Remitente</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;">${process.env.ZEPTO_SENDER || 'portal@lideresenseguros.com'}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Entorno</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;">${process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Fecha / Hora</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;">${now.toLocaleString('es-PA')}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Timestamp</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;"><code>${now.toISOString()}</code></td>
            </tr>
          </table>
          <p style="font-size:12px;color:#6b7280;margin-top:16px;">Si recibes este correo, la configuración de Zepto está funcionando correctamente. 🎉</p>
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
            <p>Líderes en Seguros, S.A. | portal.lideresenseguros.com</p>
          </div>
        </div>
      </div>
    `;

    // 3. Send via centralized service
    const result = await emailService.send({
      to: recipient,
      subject: `[TEST] Correo de prueba — Portal LISSA — ${now.toLocaleString('es-PA')}`,
      html,
    });

    // 4. Log to ops_activity_log
    try {
      const supabase = getSupabaseAdmin();
      await (supabase as any).from('ops_activity_log').insert({
        user_id: null,
        action_type: 'email_test_send',
        entity_type: 'email',
        entity_id: null,
        metadata: {
          provider: result.provider,
          success: result.success,
          environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
          recipient,
          error_code: result.error_code || null,
          message_id: result.messageId || null,
          timestamp: now.toISOString(),
        },
      });
    } catch (logErr) {
      console.error('[EMAIL-TEST] Failed to log activity:', logErr);
    }

    // 5. Return result
    if (result.success) {
      console.log('[EMAIL-TEST] ✓ Test email sent successfully');
      return NextResponse.json({
        success: true,
        provider: result.provider,
        vercel_env: result.vercel_env,
        message_id: result.messageId,
        recipient,
        message: `Correo de prueba enviado exitosamente a ${recipient}`,
      });
    } else {
      console.error('[EMAIL-TEST] ✗ Failed:', result.error);
      return NextResponse.json({
        success: false,
        provider: result.provider,
        vercel_env: result.vercel_env,
        error_code: result.error_code,
        error_message: result.error,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[EMAIL-TEST] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      provider: 'none',
      vercel_env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      error_code: 'UNEXPECTED_ERROR',
      error_message: error.message,
    }, { status: 500 });
  }
}
