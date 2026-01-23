/**
 * DIAGNOSTICS ENDPOINT - E2E Test
 * ================================
 * Test completo del flujo: SMTP → IMAP → Vertex → CaseEngine → UI
 * 
 * Flujo:
 * 1. Envía email de prueba (portal@ → tramites@)
 * 2. Polling IMAP cada 10s hasta encontrarlo (máx 6 intentos = 60s)
 * 3. Ejecuta pipeline completo de ingestion
 * 4. Verifica que el caso se creó
 * 5. Verifica que el caso es visible en UI
 * 6. Guarda evidencia en diagnostic_runs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTransport } from '@/server/email/mailer';
import { createImapConnection } from '@/lib/imap/imapClient';
import { classifyInboundEmail } from '@/lib/vertex/vertexClient';
import { processInboundEmail } from '@/lib/cases/caseEngine';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface DiagnosticStep {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

export async function POST(request: NextRequest) {
  // Verificar autorización
  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = authHeader?.replace('Bearer ', '') || xCronSecret;

  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const overallStart = Date.now();
  const timestamp = new Date().toISOString();
  const testId = `E2E-${Date.now()}`;
  const testSubject = `AUTOTEST E2E ${testId}`;

  const steps: DiagnosticStep[] = [];
  let diagnosticRunId: string | null = null;
  let inboundEmailId: string | null = null;
  let caseId: string | null = null;
  let ticket: string | null = null;

  try {
    // Crear registro de diagnóstico
    const { data: diagRun } = await (supabase as any)
      .from('diagnostic_runs')
      .insert({
        test_type: 'e2e',
        started_at: timestamp,
        test_email_subject: testSubject,
        status: 'running',
      })
      .select()
      .single();

    diagnosticRunId = diagRun?.id || null;

    // PASO 1: Enviar email SMTP
    console.log('[E2E] PASO 1: Enviando email SMTP...');
    const smtpStart = Date.now();
    
    try {
      const transporter = getTransport('PORTAL');
      const info = await transporter.sendMail({
        from: '"Portal Test" <portal@lideresenseguros.com>',
        to: 'tramites@lideresenseguros.com',
        subject: testSubject,
        text: `Test E2E automatizado\n\nTest ID: ${testId}\nTimestamp: ${timestamp}`,
        html: `
          <div style="font-family: Arial; padding: 20px;">
            <h2>🧪 Test E2E Automatizado</h2>
            <p><strong>Test ID:</strong> ${testId}</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
            <p>Este correo debe ser procesado automáticamente y crear un caso visible en Pendientes.</p>
          </div>
        `,
      });

      steps.push({
        name: 'smtp_send',
        success: true,
        duration: Date.now() - smtpStart,
        data: { messageId: info.messageId },
      });

      console.log('[E2E] ✅ SMTP enviado:', info.messageId);
    } catch (error: any) {
      steps.push({
        name: 'smtp_send',
        success: false,
        duration: Date.now() - smtpStart,
        error: error.message,
      });
      throw new Error(`SMTP falló: ${error.message}`);
    }

    // PASO 2: Polling IMAP (6 intentos, cada 10s)
    console.log('[E2E] PASO 2: Polling IMAP...');
    const imapStart = Date.now();
    let client;
    let foundMessage: any = null;

    try {
      for (let attempt = 1; attempt <= 6; attempt++) {
        console.log(`[E2E] IMAP intento ${attempt}/6...`);

        client = await createImapConnection();
        const mailbox = await client.getMailboxLock('INBOX');

        try {
          // Buscar mensajes recientes con nuestro subject
          for await (const msg of client.fetch('1:50', {
            envelope: true,
            uid: true,
            bodyStructure: true,
          })) {
            if (msg.envelope?.subject?.includes(testId)) {
              foundMessage = {
                uid: msg.uid,
                messageId: msg.envelope.messageId,
                subject: msg.envelope.subject,
                from: msg.envelope.from?.[0]?.address,
                date: msg.envelope.date,
              };
              break;
            }
          }
        } finally {
          mailbox.release();
        }

        await client.logout();

        if (foundMessage) {
          console.log('[E2E] ✅ Mensaje encontrado en IMAP');
          break;
        }

        // Esperar 10s antes del siguiente intento
        if (attempt < 6) {
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

      if (!foundMessage) {
        steps.push({
          name: 'imap_poll',
          success: false,
          duration: Date.now() - imapStart,
          error: 'Mensaje no encontrado después de 60s',
        });
        throw new Error('Mensaje no encontrado en IMAP después de 60s - verificar que SMTP llegó');
      }

      steps.push({
        name: 'imap_poll',
        success: true,
        duration: Date.now() - imapStart,
        data: foundMessage,
      });
    } catch (error: any) {
      if (client) {
        try {
          await client.logout();
        } catch (e) {
          // Ignore
        }
      }

      if (!steps.find(s => s.name === 'imap_poll')) {
        steps.push({
          name: 'imap_poll',
          success: false,
          duration: Date.now() - imapStart,
          error: error.message,
        });
      }
      throw error;
    }

    // PASO 3: Guardar en inbound_emails
    console.log('[E2E] PASO 3: Guardando en inbound_emails...');
    const dbStart = Date.now();

    try {
      // @ts-ignore
      const { data: inboundEmail, error: dbError } = await supabase
        .from('inbound_emails')
        .insert({
          message_id: foundMessage.messageId,
          subject: foundMessage.subject,
          from_email: foundMessage.from,
          to_email: 'tramites@lideresenseguros.com',
          received_at: foundMessage.date || new Date().toISOString(),
          raw_headers: JSON.stringify(foundMessage),
          processed_status: 'pending',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      inboundEmailId = inboundEmail.id;

      steps.push({
        name: 'db_insert',
        success: true,
        duration: Date.now() - dbStart,
        data: { inboundEmailId },
      });

      console.log('[E2E] ✅ inbound_emails guardado:', inboundEmailId);
    } catch (error: any) {
      steps.push({
        name: 'db_insert',
        success: false,
        duration: Date.now() - dbStart,
        error: error.message,
      });
      throw new Error(`DB insert falló: ${error.message}`);
    }

    // PASO 4: Clasificación Vertex AI
    console.log('[E2E] PASO 4: Clasificando con Vertex AI...');
    const vertexStart = Date.now();
    let aiClassification: any;

    try {
      aiClassification = await classifyInboundEmail({
        subject: foundMessage.subject,
        body_text_normalized: `Test E2E - ${testId}`,
        from: foundMessage.from,
        cc: [],
        attachments_summary: '',
      });

      steps.push({
        name: 'vertex_classify',
        success: true,
        duration: Date.now() - vertexStart,
        data: {
          ramoBucket: aiClassification.ramo_bucket,
          confidence: aiClassification.confidence,
        },
      });

      console.log('[E2E] ✅ Vertex clasificó:', aiClassification.ramo_bucket);
    } catch (error: any) {
      steps.push({
        name: 'vertex_classify',
        success: false,
        duration: Date.now() - vertexStart,
        error: error.message,
      });
      throw new Error(`Vertex AI falló: ${error.message}`);
    }

    // PASO 5: Crear caso con CaseEngine
    console.log('[E2E] PASO 5: Creando caso con CaseEngine...');
    const caseStart = Date.now();

    try {
      const caseResult = await processInboundEmail({
        inboundEmailId: inboundEmailId!,
        aiClassification,
        emailFrom: foundMessage.from,
        emailSubject: foundMessage.subject,
        emailCc: [],
      });

      if (!caseResult.success) {
        throw new Error(caseResult.message || 'Case engine falló');
      }

      caseId = caseResult.caseId || null;
      ticket = caseResult.ticket || null;

      steps.push({
        name: 'case_create',
        success: true,
        duration: Date.now() - caseStart,
        data: { caseId, ticket },
      });

      console.log('[E2E] ✅ Caso creado:', ticket);
    } catch (error: any) {
      steps.push({
        name: 'case_create',
        success: false,
        duration: Date.now() - caseStart,
        error: error.message,
      });
      throw new Error(`CaseEngine falló: ${error.message}`);
    }

    // PASO 6: Verificar visible en UI
    console.log('[E2E] PASO 6: Verificando visibilidad en UI...');
    const uiStart = Date.now();

    try {
      const { data: visibleCase, error: uiError } = await supabase
        .from('cases')
        .select('id, ticket, estado_simple, ramo_bucket')
        .eq('id', caseId!)
        .single();

      if (uiError || !visibleCase) {
        throw new Error('Caso NO visible en query de UI');
      }

      steps.push({
        name: 'ui_query',
        success: true,
        duration: Date.now() - uiStart,
        data: visibleCase,
      });

      console.log('[E2E] ✅ Caso visible en UI');
    } catch (error: any) {
      steps.push({
        name: 'ui_query',
        success: false,
        duration: Date.now() - uiStart,
        error: error.message,
      });
      throw new Error(`UI query falló: ${error.message}`);
    }

    // SUCCESS - Actualizar diagnostic_run
    const totalDuration = Date.now() - overallStart;

    if (diagnosticRunId) {
      await (supabase as any)
        .from('diagnostic_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          inbound_email_id: inboundEmailId,
          case_id: caseId,
          ticket,
          steps: steps.reduce((acc, step) => ({ ...acc, [step.name]: step.success }), {}),
          summary: `✅ Test E2E EXITOSO - Caso ${ticket} creado y visible`,
          metadata: { steps, totalDuration },
        })
        .eq('id', diagnosticRunId);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      testId,
      diagnosticRunId,
      results: {
        inboundEmailId,
        caseId,
        ticket,
      },
      steps,
      summary: `✅ TEST E2E EXITOSO - Caso ${ticket} creado y visible en ${totalDuration}ms`,
    });
  } catch (error: any) {
    console.error('[E2E] ERROR:', error);

    const totalDuration = Date.now() - overallStart;

    // Actualizar diagnostic_run con error
    if (diagnosticRunId) {
      await (supabase as any)
        .from('diagnostic_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'failed',
          inbound_email_id: inboundEmailId,
          case_id: caseId,
          ticket,
          steps: steps.reduce((acc, step) => ({ ...acc, [step.name]: step.success }), {}),
          errors: [{ message: error.message, stack: error.stack }],
          summary: `❌ Test E2E FALLÓ: ${error.message}`,
          metadata: { steps, totalDuration },
        })
        .eq('id', diagnosticRunId);
    }

    // Identificar paso fallido
    const failedStep = steps.find(s => !s.success) || { name: 'unknown' };

    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      testId,
      diagnosticRunId,
      error: error.message,
      failedStep: failedStep.name,
      steps,
      summary: `❌ Test E2E FALLÓ en paso: ${failedStep.name} - ${error.message}`,
    }, { status: 500 });
  }
}
