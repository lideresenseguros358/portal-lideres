import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * CLEANUP TEST DATA
 * 
 * Limpia todos los datos generados por testing
 * - Casos con flag is_test o prefijo TEST-
 * - Correos de prueba
 * - Logs de testing
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
    const results = {
      success: true,
      deleted: {
        cases: 0,
        inboundEmails: 0,
        emailLogs: 0,
        testRuns: 0,
        caseFiles: 0,
        caseComments: 0,
      },
      errors: [] as string[],
    };

    console.log('[CLEANUP TEST] Starting cleanup of test data...');

    // =====================================================
    // 1. ELIMINAR CASOS DE PRUEBA
    // =====================================================
    try {
      const { data: testCases } = await supabase
        .from('cases')
        .select('id')
        .or('is_test.eq.true,ticket.ilike.%TEST%,notes.ilike.%TEST-%');

      if (testCases && testCases.length > 0) {
        const caseIds = testCases.map(c => c.id);

        // Eliminar archivos relacionados
        const { error: filesError } = await supabase
          .from('case_files')
          .delete()
          .in('case_id', caseIds);

        if (!filesError) {
          results.deleted.caseFiles = testCases.length;
        }

        // Eliminar comentarios relacionados
        const { error: commentsError } = await supabase
          .from('case_comments')
          .delete()
          .in('case_id', caseIds);

        if (!commentsError) {
          results.deleted.caseComments = testCases.length;
        }

        // Eliminar casos
        const { error: casesError } = await supabase
          .from('cases')
          .delete()
          .in('id', caseIds);

        if (!casesError) {
          results.deleted.cases = testCases.length;
          console.log(`[CLEANUP TEST] Deleted ${testCases.length} test cases`);
        } else {
          results.errors.push(`Cases deletion error: ${casesError.message}`);
        }
      }
    } catch (error: any) {
      results.errors.push(`Cases cleanup error: ${error.message}`);
      results.success = false;
    }

    // =====================================================
    // 2. ELIMINAR CORREOS DE PRUEBA
    // =====================================================
    try {
      const { error: inboundError } = await supabase
        .from('inbound_emails')
        .delete()
        .or('is_test.eq.true,subject.ilike.%TEST%');

      if (!inboundError) {
        results.deleted.inboundEmails = 1; // No podemos saber cuántos sin hacer select primero
        console.log(`[CLEANUP TEST] Deleted test inbound emails`);
      } else {
        results.errors.push(`Inbound emails deletion error: ${inboundError.message}`);
      }
    } catch (error: any) {
      results.errors.push(`Inbound emails cleanup error: ${error.message}`);
      results.success = false;
    }

    // =====================================================
    // 3. ELIMINAR LOGS DE EMAIL DE PRUEBA
    // =====================================================
    try {
      const { error: logsError } = await supabase
        .from('email_logs')
        .delete()
        .or('is_test.eq.true,subject.ilike.%TEST%');

      if (!logsError) {
        results.deleted.emailLogs = 1;
        console.log(`[CLEANUP TEST] Deleted test email logs`);
      } else {
        results.errors.push(`Email logs deletion error: ${logsError.message}`);
      }
    } catch (error: any) {
      results.errors.push(`Email logs cleanup error: ${error.message}`);
      results.success = false;
    }

    // =====================================================
    // 4. ELIMINAR REGISTROS DE TEST RUNS
    // =====================================================
    try {
      // TODO: Descomentar después de aplicar migración 20260122170000_create_test_runs.sql
      // const { error: testRunsError } = await supabase
      //   .from('test_runs')
      //   .delete()
      //   .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      // if (!testRunsError) {
      //   results.deleted.testRuns = 1;
      //   console.log(`[CLEANUP TEST] Deleted old test runs`);
      // } else {
      //   results.errors.push(`Test runs deletion error: ${testRunsError.message}`);
      // }
      console.log(`[CLEANUP TEST] Test runs cleanup skipped - table not created yet`);
    } catch (error: any) {
      results.errors.push(`Test runs cleanup error: ${error.message}`);
      results.success = false;
    }

    console.log(`[CLEANUP TEST] Cleanup completed. Success: ${results.success}`);

    return NextResponse.json({
      success: results.success,
      message: 'Test data cleanup completed',
      deleted: results.deleted,
      errors: results.errors.length > 0 ? results.errors : undefined,
    }, { status: results.success ? 200 : 500 });

  } catch (error: any) {
    console.error('[CLEANUP TEST] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

/**
 * GET - Ver estadísticas de datos de testing
 */
export async function GET(request: NextRequest) {
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

    // Contar datos de testing
    const { count: casesCount } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .or('is_test.eq.true,ticket.ilike.%TEST%');

    const { count: emailsCount } = await supabase
      .from('inbound_emails')
      .select('*', { count: 'exact', head: true })
      .or('is_test.eq.true,subject.ilike.%TEST%');

    const { count: logsCount } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .or('is_test.eq.true,subject.ilike.%TEST%');

    // TODO: Descomentar después de aplicar migración
    // const { count: testRunsCount } = await supabase
    //   .from('test_runs')
    //   .select('*', { count: 'exact', head: true });
    const testRunsCount = 0;

    return NextResponse.json({
      success: true,
      testData: {
        cases: casesCount || 0,
        inboundEmails: emailsCount || 0,
        emailLogs: logsCount || 0,
        testRuns: testRunsCount || 0,
      }
    });

  } catch (error: any) {
    console.error('[CLEANUP TEST] Error getting stats:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
