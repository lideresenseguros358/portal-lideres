import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import nodemailer from 'nodemailer';

/**
 * TEST E2E: SMTP → IMAP → IA → CASE
 * 
 * Este endpoint ejecuta un flujo completo de testing:
 * 1. Envía un correo de prueba vía SMTP
 * 2. Espera brevemente
 * 3. Procesa el correo con IMAP
 * 4. Clasifica con IA
 * 5. Crea caso automáticamente
 * 6. Verifica resultados
 */
export async function POST(request: NextRequest) {
  try {
    // Validar CRON_SECRET
    const authHeader = request.headers.get('x-cron-secret');
    if (authHeader !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid CRON_SECRET' },
        { status: 401 }
      );
    }

    const supabase = await getSupabaseServer();
    const testId = `TEST-${Date.now()}`;
    const testResults = {
      success: false,
      testType: 'E2E SMTP → IMAP → CASE',
      testId,
      emailSent: false,
      imapProcessed: false,
      caseCreated: false,
      ticket: null,
      brokerDetected: null,
      aiConfidence: null,
      errors: [] as string[],
      timestamps: {
        started: new Date().toISOString(),
        emailSent: null as string | null,
        imapProcessed: null as string | null,
        caseCreated: null as string | null,
        completed: null as string | null,
      }
    };

    console.log(`[E2E TEST] Starting test ${testId}`);

    // =====================================================
    // PASO 1: GENERAR DATOS FICTICIOS
    // =====================================================
    const testData = {
      client: {
        name: 'Cliente Prueba Cron',
        nationalId: '8-888-8888',
        phone: '6000-0000',
        email: 'prueba@test.com',
      },
      case: {
        type: 'RENOVACION',
        policyType: 'AUTO',
        insurer: 'ASSA',
        policyNumber: 'TEST-AUTO-001',
      },
      broker: {
        email: 'javiersamudio@lideresenseguros.com',
      }
    };

    // =====================================================
    // PASO 2: ENVIAR CORREO SMTP
    // =====================================================
    console.log(`[E2E TEST] Sending test email via SMTP...`);
    
    const emailSubject = `TEST – Renovación póliza auto – ${testData.client.name}`;
    const emailBody = `
CORREO DE PRUEBA AUTOMATIZADA - NO RESPONDER

Cliente: ${testData.client.name}
Cédula: ${testData.client.nationalId}
Teléfono: ${testData.client.phone}

Tipo de trámite: ${testData.case.type}
Póliza: ${testData.case.policyType}
Aseguradora: ${testData.case.insurer}
Número de póliza: ${testData.case.policyNumber}

Broker asignado: ${testData.broker.email}

Este es un correo generado automáticamente por el sistema de testing.
Test ID: ${testId}
Timestamp: ${new Date().toISOString()}
    `.trim();

    try {
      // Configurar transporter SMTP
      const transporter = nodemailer.createTransport({
        host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
        port: parseInt(process.env.ZOHO_SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.ZOHO_SMTP_USER || 'portal@lideresenseguros.com',
          pass: process.env.ZOHO_SMTP_PASS,
        },
      });

      // Enviar email
      await transporter.sendMail({
        from: 'portal@lideresenseguros.com',
        to: 'tramites@lideresenseguros.com',
        cc: testData.broker.email,
        subject: emailSubject,
        text: emailBody,
        html: `<pre>${emailBody}</pre>`,
      });

      testResults.emailSent = true;
      testResults.timestamps.emailSent = new Date().toISOString();
      console.log(`[E2E TEST] Email sent successfully`);
    } catch (error: any) {
      testResults.errors.push(`SMTP Error: ${error.message}`);
      console.error(`[E2E TEST] SMTP failed:`, error);
      throw error;
    }

    // =====================================================
    // PASO 3: ESPERAR BREVEMENTE
    // =====================================================
    console.log(`[E2E TEST] Waiting 8 seconds for email delivery...`);
    await new Promise(resolve => setTimeout(resolve, 8000));

    // =====================================================
    // PASO 4: PROCESAR IMAP MANUALMENTE
    // =====================================================
    console.log(`[E2E TEST] Processing IMAP...`);
    
    try {
      // TODO: Ejecutar la lógica que el cron IMAP
      // Por ahora marcamos como procesado y verificamos en BD
      testResults.imapProcessed = true;
      testResults.timestamps.imapProcessed = new Date().toISOString();
      console.log(`[E2E TEST] IMAP check: verificar manualmente /api/cron/imap-ingest`);
      testResults.errors.push('IMAP: Execute /api/cron/imap-ingest manually to process');
    } catch (error: any) {
      testResults.errors.push(`IMAP Error: ${error.message}`);
      console.error(`[E2E TEST] IMAP failed:`, error);
    }

    // =====================================================
    // PASO 5: VERIFICAR CASO CREADO
    // =====================================================
    console.log(`[E2E TEST] Verifying case creation...`);
    
    try {
      // Buscar el caso recién creado por test ID o subject
      const { data: testCase, error: caseError } = await supabase
        .from('cases')
        .select('*, broker:brokers(email)')
        .or(`notes.ilike.%${testId}%,ticket.ilike.%TEST%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (testCase) {
        testResults.caseCreated = true;
        testResults.ticket = testCase.ticket as any;
        testResults.brokerDetected = (testCase as any).broker?.email || null;
        testResults.aiConfidence = (testCase.ai_confidence as any) || null;
        testResults.timestamps.caseCreated = new Date().toISOString();
        
        console.log(`[E2E TEST] Case created: ${testCase.ticket}`);
        console.log(`[E2E TEST] Broker detected: ${testResults.brokerDetected}`);
        console.log(`[E2E TEST] AI confidence: ${testResults.aiConfidence}`);
      } else {
        testResults.errors.push('Case not created - may need more time or classification failed');
      }
    } catch (error: any) {
      testResults.errors.push(`Case verification error: ${error.message}`);
      console.error(`[E2E TEST] Case verification failed:`, error);
    }

    // =====================================================
    // PASO 6: VERIFICACIONES AUTOMÁTICAS
    // =====================================================
    console.log(`[E2E TEST] Running automatic verifications...`);
    
    const verifications = {
      cronRunExists: false,
      inboundEmailExists: false,
      caseWithTicketExists: false,
      brokerAssigned: false,
      emailLogExists: false,
    };

    try {
      // Verificar cron_runs
      const { data: cronRun } = await supabase
        .from('cron_runs')
        .select('id')
        .gte('started_at', new Date(Date.now() - 60000).toISOString())
        .limit(1)
        .single();
      
      verifications.cronRunExists = !!cronRun;

      // Verificar inbound_emails
      const { data: inboundEmail } = await supabase
        .from('inbound_emails')
        .select('id')
        .ilike('subject', `%${testId}%`)
        .limit(1)
        .single();
      
      verifications.inboundEmailExists = !!inboundEmail;

      // Verificar caso con ticket
      verifications.caseWithTicketExists = !!testResults.ticket;
      verifications.brokerAssigned = !!testResults.brokerDetected;

      // Verificar email_logs
      const { data: emailLog } = await supabase
        .from('email_logs')
        .select('id')
        .ilike('subject', `%TEST%`)
        .gte('created_at', testResults.timestamps.started)
        .limit(1)
        .single();
      
      verifications.emailLogExists = !!emailLog;

    } catch (error: any) {
      console.error(`[E2E TEST] Verifications error:`, error);
    }

    // =====================================================
    // RESULTADO FINAL
    // =====================================================
    testResults.timestamps.completed = new Date().toISOString();
    testResults.success = testResults.emailSent && 
                          testResults.imapProcessed && 
                          testResults.caseCreated &&
                          testResults.errors.length === 0;

    // Guardar resultado del test
    // TODO: Descomentar después de aplicar migración 20260122170000_create_test_runs.sql
    // await supabase.from('test_runs').insert({
    //   test_type: 'e2e-imap',
    //   test_id: testId,
    //   success: testResults.success,
    //   results: testResults,
    //   verifications,
    //   created_at: new Date().toISOString(),
    // });

    console.log(`[E2E TEST] Test completed. Success: ${testResults.success}`);

    return NextResponse.json({
      ...testResults,
      verifications,
      duration: new Date(testResults.timestamps.completed!).getTime() - 
                new Date(testResults.timestamps.started).getTime(),
    }, { status: testResults.success ? 200 : 500 });

  } catch (error: any) {
    console.error('[E2E TEST] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}
