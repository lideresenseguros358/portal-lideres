/**
 * IMAP AUTOTEST - Autodepuración End-to-End
 * ==========================================
 * Endpoint que ejecuta test completo del flujo IMAP:
 * 1. Envía correo REAL a tramites@lideresenseguros.com
 * 2. Ejecuta ingestion directamente
 * 3. Monitorea cada paso con logging detallado
 * 4. Reporta dónde falla el flujo
 * 
 * USO: GET /api/test/imap-autotest
 */

import { NextRequest, NextResponse } from 'next/server';
import { runIngestionCycle } from '@/lib/imap/imapIngestor';
import { generateTestId, logImapDebug } from '@/lib/debug/imapLogger';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const testId = generateTestId();
  const timestamp = new Date().toISOString();

  try {
    await logImapDebug({
      testId,
      stage: 'imap_connect',
      status: 'info',
      message: 'AUTOTEST iniciado',
      payload: { testId, timestamp },
    });

    // PASO 1: Ejecutar ingestion directamente (sin enviar correo)
    // El usuario puede enviar correo manual a tramites@ y luego ejecutar este endpoint
    console.log('[AUTOTEST] Ejecutando ingestion cycle...');

    const ingestionResult = await runIngestionCycle();

    await logImapDebug({
      testId,
      stage: 'imap_fetch',
      status: ingestionResult.success ? 'success' : 'error',
      message: `Ingestion completada: ${ingestionResult.messagesProcessed} mensajes`,
      payload: {
        messagesProcessed: ingestionResult.messagesProcessed,
        casesCreated: ingestionResult.casesCreated,
        casesLinked: ingestionResult.casesLinked,
        errors: ingestionResult.errors,
      },
    });

    // PASO 4: Verificar si el correo de test fue procesado
    const supabase = getSupabaseAdmin();

    // @ts-ignore
    const { data: inboundEmails } = await supabase
      .from('inbound_emails')
      .select('id, message_id, subject, processed_status, error_detail')
      .ilike('subject', `%${testId}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    const testEmail = inboundEmails?.[0];

    if (!testEmail) {
      await logImapDebug({
        testId,
        stage: 'db_insert',
        status: 'error',
        message: 'Correo de test NO fue insertado en inbound_emails',
        errorDetail: 'IMAP no captó el correo o falló la inserción',
      });
    } else {
      await logImapDebug({
        testId,
        messageId: testEmail.message_id,
        inboundEmailId: testEmail.id,
        stage: 'db_insert',
        status: 'success',
        message: 'Correo de test insertado en inbound_emails',
        payload: {
          inbound_email_id: testEmail.id,
          processed_status: testEmail.processed_status,
        },
      });

      // PASO 5: Verificar si se creó caso
      // @ts-ignore
      const { data: caseEmails } = await supabase
        .from('case_emails')
        .select('case_id, cases(id, ticket, estado_simple, ramo_bucket)')
        .eq('inbound_email_id', testEmail.id)
        .limit(1);

      const linkedCase = caseEmails?.[0];

      if (!linkedCase) {
        await logImapDebug({
          testId,
          messageId: testEmail.message_id,
          inboundEmailId: testEmail.id,
          stage: 'case_create',
          status: 'error',
          message: 'NO se creó caso para el correo de test',
          errorDetail: testEmail.error_detail || 'Case Engine no creó caso',
        });
      } else {
        const caseData = (linkedCase as any).cases;

        await logImapDebug({
          testId,
          messageId: testEmail.message_id,
          inboundEmailId: testEmail.id,
          caseId: caseData.id,
          stage: 'case_create',
          status: 'success',
          message: 'Caso creado exitosamente',
          payload: {
            case_id: caseData.id,
            ticket: caseData.ticket,
            estado_simple: caseData.estado_simple,
            ramo_bucket: caseData.ramo_bucket,
          },
        });

        // PASO 6: Verificar si es visible en UI
        // Query similar a la de Pendientes
        // @ts-ignore
        const { data: visibleCase } = await supabase
          .from('cases')
          .select('id, ticket, estado_simple')
          .eq('id', caseData.id)
          .single();

        if (visibleCase) {
          await logImapDebug({
            testId,
            caseId: caseData.id,
            stage: 'ui_query',
            status: 'success',
            message: 'Caso ES VISIBLE en queries de UI',
            payload: { case_id: visibleCase.id },
          });
        } else {
          await logImapDebug({
            testId,
            caseId: caseData.id,
            stage: 'ui_query',
            status: 'warning',
            message: 'Caso creado pero NO VISIBLE en UI',
            errorDetail: 'Posible problema de RLS o query filters',
          });
        }
      }
    }

    // Generar reporte (logs detallados en Vercel console)
    const report = {
      testId,
      timestamp,
      success: ingestionResult.success,
      ingestionResult,
      diagnosis: ingestionResult.success && ingestionResult.casesCreated > 0
        ? '✅ FLUJO COMPLETO FUNCIONANDO'
        : ingestionResult.messagesProcessed === 0
        ? '⚠️ No se encontraron mensajes - verificar IMAP o enviar correo'
        : ingestionResult.errors.length > 0
        ? `❌ FALLO: ${ingestionResult.errors[0]?.error || 'Error desconocido'}`
        : '⚠️ Mensajes procesados pero sin casos creados - revisar logs detallados',
      instructions: 'Ver logs detallados en Vercel console. Buscar [IMAP DEBUG] en logs.',
      note: 'Para test completo: envía correo a tramites@ y ejecuta este endpoint.',
    };

    return NextResponse.json(report, { status: 200 });
  } catch (error: any) {
    await logImapDebug({
      testId,
      stage: 'imap_connect',
      status: 'error',
      message: 'Error fatal en autotest',
      errorDetail: error.message,
    });

    return NextResponse.json(
      {
        testId,
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

