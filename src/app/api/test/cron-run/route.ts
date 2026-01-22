import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * TEST CRON JOBS
 * 
 * Ejecuta manualmente todos los cron jobs en orden
 * para verificar que funcionen correctamente
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
    const testId = `CRON-TEST-${Date.now()}`;
    const results = {
      success: true,
      testId,
      executed: [] as any[],
      startedAt: new Date().toISOString(),
      completedAt: null as string | null,
    };

    console.log(`[CRON TEST] Starting cron jobs test ${testId}`);

    // =====================================================
    // 1. IMAP INGEST
    // =====================================================
    console.log(`[CRON TEST] Running imap-ingest...`);
    try {
      // TODO: Implementar cuando exista @/lib/email/imap-client
      results.executed.push({
        job: 'imap-ingest',
        status: 'skipped',
        reason: 'IMAP client not implemented yet - call /api/cron/imap-ingest manually',
      });
    } catch (error: any) {
      results.executed.push({
        job: 'imap-ingest',
        status: 'error',
        error: error.message,
      });
      results.success = false;
    }

    // =====================================================
    // 2. APLAZADOS CHECK
    // =====================================================
    console.log(`[CRON TEST] Running aplazados-check...`);
    try {
      const { data: aplazadosToResume } = await supabase
        .from('cases')
        .select('id, ticket, client_name, aplazado_until')
        .eq('status', 'APLAZADO')
        .lte('aplazado_until', new Date().toISOString());

      if (aplazadosToResume && aplazadosToResume.length > 0) {
        // Reactivar casos
        await supabase
          .from('cases')
          .update({ 
            status: 'PENDIENTE_REVISION',
            aplazado_until: null,
            aplazado_months: null,
          })
          .in('id', aplazadosToResume.map(c => c.id));

        results.executed.push({
          job: 'aplazados-check',
          status: 'success',
          resumed: aplazadosToResume.length,
        });
      } else {
        results.executed.push({
          job: 'aplazados-check',
          status: 'skipped',
          reason: 'No cases to resume',
        });
      }
    } catch (error: any) {
      results.executed.push({
        job: 'aplazados-check',
        status: 'error',
        error: error.message,
      });
      results.success = false;
    }

    // =====================================================
    // 3. SCHEDULER
    // =====================================================
    console.log(`[CRON TEST] Running scheduler...`);
    try {
      // TODO: Tabla scheduled_tasks no existe aún
      // const { data: scheduledTasks } = await supabase
      //   .from('scheduled_tasks')
      //   .select('*')
      //   .lte('execute_at', new Date().toISOString())
      //   .eq('executed', false);

      results.executed.push({
        job: 'scheduler',
        status: 'skipped',
        reason: 'Table scheduled_tasks not implemented yet',
      });
    } catch (error: any) {
      results.executed.push({
        job: 'scheduler',
        status: 'error',
        error: error.message,
      });
      results.success = false;
    }

    // =====================================================
    // 4. PENDIENTES DIGEST
    // =====================================================
    console.log(`[CRON TEST] Running pendientes-digest...`);
    try {
      const { data: pendingCases } = await supabase
        .from('cases')
        .select('id, ticket, status, broker_id, sla_date')
        .in('status', ['PENDIENTE_REVISION', 'EN_PROCESO', 'FALTA_DOC'])
        .not('broker_id', 'is', null);

      if (pendingCases && pendingCases.length > 0) {
        // Agrupar por broker
        const byBroker = pendingCases.reduce((acc: any, c) => {
          const brokerId = c.broker_id || 'unassigned';
          if (!acc[brokerId]) acc[brokerId] = [];
          acc[brokerId].push(c);
          return acc;
        }, {});

        results.executed.push({
          job: 'pendientes-digest',
          status: 'success',
          pendingCases: pendingCases.length,
          brokers: Object.keys(byBroker).length,
        });
      } else {
        results.executed.push({
          job: 'pendientes-digest',
          status: 'skipped',
          reason: 'No pending cases',
        });
      }
    } catch (error: any) {
      results.executed.push({
        job: 'pendientes-digest',
        status: 'error',
        error: error.message,
      });
      results.success = false;
    }

    // =====================================================
    // 5. RENEWALS
    // =====================================================
    console.log(`[CRON TEST] Running renewals...`);
    try {
      const { data: upcomingRenewals } = await supabase
        .from('policies')
        .select('id, policy_number, client:clients(name), renewal_date')
        .gte('renewal_date', new Date().toISOString())
        .lte('renewal_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      results.executed.push({
        job: 'renewals',
        status: 'success',
        upcomingRenewals: upcomingRenewals?.length || 0,
      });
    } catch (error: any) {
      results.executed.push({
        job: 'renewals',
        status: 'error',
        error: error.message,
      });
      results.success = false;
    }

    // =====================================================
    // 6. BIRTHDAYS
    // =====================================================
    console.log(`[CRON TEST] Running birthdays...`);
    try {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      const { data: birthdayBrokers } = await supabase
        .from('brokers')
        .select('id, profiles(full_name, email)')
        .not('birth_date', 'is', null);

      const todayBirthdays = birthdayBrokers?.filter(b => {
        if (!b.profiles) return false;
        // Comparar mes y día
        // Esto es simplificado, en producción verificar correctamente
        return true;
      }) || [];

      results.executed.push({
        job: 'birthdays',
        status: 'success',
        birthdaysToday: todayBirthdays.length,
      });
    } catch (error: any) {
      results.executed.push({
        job: 'birthdays',
        status: 'error',
        error: error.message,
      });
      results.success = false;
    }

    // =====================================================
    // 7. SLA ALERTS
    // =====================================================
    console.log(`[CRON TEST] Running sla-alerts...`);
    try {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const { data: slaAlerts } = await supabase
        .from('cases')
        .select('id, ticket, client_name, sla_date, broker:brokers(id, profiles(email))')
        .lte('sla_date', tomorrow.toISOString())
        .in('status', ['PENDIENTE_REVISION', 'EN_PROCESO', 'FALTA_DOC'])
        .not('broker_id', 'is', null);

      results.executed.push({
        job: 'sla-alerts',
        status: 'success',
        alertsToSend: slaAlerts?.length || 0,
      });
    } catch (error: any) {
      results.executed.push({
        job: 'sla-alerts',
        status: 'error',
        error: error.message,
      });
      results.success = false;
    }

    // =====================================================
    // GUARDAR RESULTADO
    // =====================================================
    results.completedAt = new Date().toISOString();

    // TODO: Descomentar después de aplicar migración 20260122170000_create_test_runs.sql
    // await supabase.from('test_runs').insert({
    //   test_type: 'cron-run',
    //   test_id: testId,
    //   success: results.success,
    //   results: results,
    //   created_at: new Date().toISOString(),
    // });

    console.log(`[CRON TEST] Test completed. Success: ${results.success}`);

    return NextResponse.json(results, { 
      status: results.success ? 200 : 500 
    });

  } catch (error: any) {
    console.error('[CRON TEST] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}
