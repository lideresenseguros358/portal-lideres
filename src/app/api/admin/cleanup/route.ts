import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/admin/cleanup — Get statistics of data to cleanup
 * Returns counts of ALL data in Operaciones and ADM COT modules
 */
export async function GET(request: NextRequest) {
  try {
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Count ALL Operaciones data
    const operacionesStats = {
      cases: await countRows(sb, 'ops_cases'),
      renewals: await countRows(sb, 'ops_renewals'),
      petitions: await countRows(sb, 'ops_petitions'),
      urgencies: await countRows(sb, 'ops_urgencies'),
      emailThreads: await countRows(sb, 'ops_email_threads'),
    };

    // Count ALL ADM COT data
    const admCotStats = {
      conversations: await countRows(sb, 'adm_cot_conversations'),
      quotes: await countRows(sb, 'adm_cot_quotes'),
      expedientes: await countRows(sb, 'adm_cot_expedientes'),
      payments: await countRows(sb, 'adm_cot_payments'),
    };

    const total =
      Object.values(operacionesStats).reduce((a, b) => a + b, 0) +
      Object.values(admCotStats).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      stats: {
        total,
        operaciones: operacionesStats,
        admCot: admCotStats,
      },
    });
  } catch (error: any) {
    console.error('[CLEANUP] Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cleanup — Execute cleanup of ALL data
 * Deletes ALL data from Operaciones and ADM COT modules
 * Chat and Cases modules are NOT affected
 */
export async function POST(request: NextRequest) {
  try {
    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const deleted = {
      operaciones: {} as Record<string, number>,
      admCot: {} as Record<string, number>,
    };
    const errors: string[] = [];

    console.log('[CLEANUP] Starting cleanup of Operaciones & ADM COT...');

    // ========== ADM COT CLEANUP - DELETE ALL ==========
    try {
      console.log('[CLEANUP] Deleting ADM COT messages...');
      deleted.admCot.messages = await deleteAll(sb, 'adm_cot_messages');

      console.log('[CLEANUP] Deleting ADM COT tasks...');
      deleted.admCot.tasks = await deleteAll(sb, 'adm_cot_tasks');

      console.log('[CLEANUP] Deleting ADM COT conversations...');
      deleted.admCot.conversations = await deleteAll(sb, 'adm_cot_conversations');

      console.log('[CLEANUP] Deleting ADM COT payments...');
      deleted.admCot.payments = await deleteAll(sb, 'adm_cot_payments');

      console.log('[CLEANUP] Deleting ADM COT recurrences...');
      deleted.admCot.recurrences = await deleteAll(sb, 'adm_cot_recurrences');

      console.log('[CLEANUP] Deleting ADM COT expedientes...');
      deleted.admCot.expedientes = await deleteAll(sb, 'adm_cot_expedientes');

      console.log('[CLEANUP] Deleting ADM COT quotes...');
      deleted.admCot.quotes = await deleteAll(sb, 'adm_cot_quotes');

      console.log('[CLEANUP] Deleting ADM COT payment groups...');
      deleted.admCot.paymentGroups = await deleteAll(sb, 'adm_cot_payment_groups');

      console.log('[CLEANUP] Deleting ADM COT bank history...');
      deleted.admCot.bankHistory = await deleteAll(sb, 'adm_cot_bank_history');
    } catch (err: any) {
      errors.push(`ADM COT cleanup error: ${err.message}`);
      console.error('[CLEANUP] ADM COT error:', err);
    }

    // ========== OPERACIONES CLEANUP - DELETE ALL ==========
    try {
      console.log('[CLEANUP] Deleting Operaciones case history...');
      deleted.operaciones.caseHistory = await deleteAll(sb, 'ops_case_history');

      console.log('[CLEANUP] Deleting Operaciones activity logs...');
      deleted.operaciones.activityLogs = await deleteByFilter(
        sb,
        'ops_activity_log',
        { entity_type: 'case' }
      );

      console.log('[CLEANUP] Deleting Operaciones email messages...');
      deleted.operaciones.emailMessages = await deleteAll(sb, 'ops_email_messages');

      console.log('[CLEANUP] Deleting Operaciones email threads...');
      deleted.operaciones.emailThreads = await deleteAll(sb, 'ops_email_threads');

      console.log('[CLEANUP] Deleting Operaciones cases...');
      deleted.operaciones.cases = await deleteAll(sb, 'ops_cases');

      console.log('[CLEANUP] Deleting Operaciones renewals...');
      deleted.operaciones.renewals = await deleteAll(sb, 'ops_renewals');

      console.log('[CLEANUP] Deleting Operaciones petitions...');
      deleted.operaciones.petitions = await deleteAll(sb, 'ops_petitions');

      console.log('[CLEANUP] Deleting Operaciones urgencies...');
      deleted.operaciones.urgencies = await deleteAll(sb, 'ops_urgencies');
    } catch (err: any) {
      errors.push(`Operaciones cleanup error: ${err.message}`);
      console.error('[CLEANUP] Operaciones error:', err);
    }

    console.log(`[CLEANUP] Cleanup completed. Errors: ${errors.length}`);

    return NextResponse.json({
      success: errors.length === 0,
      message: `Limpieza completada. ${
        errors.length === 0
          ? 'Todos los datos de Operaciones y ADM COT han sido eliminados.'
          : `Limpieza completada con ${errors.length} errores.`
      }`,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[CLEANUP] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Helper functions
async function countRows(
  sb: ReturnType<typeof createClient>,
  table: string
): Promise<number> {
  try {
    const { count } = await sb
      .from(table)
      .select('id', { count: 'exact', head: true });
    return count || 0;
  } catch {
    return 0;
  }
}

async function deleteAll(
  sb: ReturnType<typeof createClient>,
  table: string
): Promise<number> {
  try {
    const { count } = await sb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    return count || 0;
  } catch {
    return 0;
  }
}

async function deleteByFilter(
  sb: ReturnType<typeof createClient>,
  table: string,
  filter: Record<string, any>
): Promise<number> {
  try {
    let query = sb.from(table).delete();
    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value);
    }
    const { count } = await query;
    return count || 0;
  } catch {
    return 0;
  }
}
