import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/admin/cleanup — Get statistics of test data
 * Returns counts of test data across all modules
 */
export async function GET(request: NextRequest) {
  try {
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Count operaciones test data
    const operacionesStats = {
      cases: await countRows(sb, 'ops_cases', {
        or: "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},ticket.ilike.TEST-%,metadata->>is_test.eq.true",
      }),
      renewals: await countRows(sb, 'ops_renewals', {
        or: "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},ticket_number.ilike.TEST-%",
      }),
      petitions: await countRows(sb, 'ops_petitions', {
        or: "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},ticket_number.ilike.TEST-%",
      }),
      urgencies: await countRows(sb, 'ops_urgencies', {
        or: "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},client_name.ilike.TEST%",
      }),
      emailThreads: await countRows(sb, 'ops_email_threads', {
        or: "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},ticket_id.ilike.TEST-%,subject.ilike.TEST%",
      }),
    };

    // Count ADM COT test data
    const admCotStats = {
      conversations: await countRows(sb, 'adm_cot_conversations', {
        or: "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},client_name.ilike.TEST%",
      }),
      quotes: await countRows(sb, 'adm_cot_quotes', {
        or: "quoted_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},status.eq.ABANDONADA,client_name.ilike.TEST%,cedula.ilike.%999%",
      }),
      expedientes: await countRows(sb, 'adm_cot_expedientes', {
        or: "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},client_name.ilike.TEST%",
      }),
      payments: await countRows(sb, 'adm_cot_payments', {
        or: "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}",
      }),
    };

    // Count chat test data
    const chatStats = {
      threads: await countRows(sb, 'chat_threads', {
        or: "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},client_name.ilike.TEST%,phone_e164.ilike.%999999%",
      }),
      messages: await countRows(sb, 'chat_messages', {
        or: "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}",
      }),
    };

    // Count legacy test data
    const legacyStats = {
      cases: await countRows(sb, 'cases', {
        or: "is_test.eq.true,ticket.ilike.TEST-%,notes.ilike.TEST-%",
      }),
      emails: await countRows(sb, 'inbound_emails', {
        or: "is_test.eq.true,subject.ilike.TEST%",
      }),
    };

    const total =
      Object.values(operacionesStats).reduce((a, b) => a + b, 0) +
      Object.values(admCotStats).reduce((a, b) => a + b, 0) +
      Object.values(chatStats).reduce((a, b) => a + b, 0) +
      Object.values(legacyStats).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      stats: {
        total,
        operaciones: operacionesStats,
        admCot: admCotStats,
        chat: chatStats,
        legacy: legacyStats,
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
 * POST /api/admin/cleanup — Execute cleanup of test data
 * Deletes all test data across modules
 */
export async function POST(request: NextRequest) {
  try {
    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const deleted = {
      operaciones: {} as Record<string, number>,
      admCot: {} as Record<string, number>,
      chat: {} as Record<string, number>,
      legacy: {} as Record<string, number>,
    };
    const errors: string[] = [];

    // ========== ADM COT CLEANUP ==========
    try {
      // Delete messages and tasks first
      const conversations = await getIds(
        sb,
        'adm_cot_conversations',
        "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},client_name.ilike.TEST%"
      );

      if (conversations.length > 0) {
        await deleteByIds(sb, 'adm_cot_messages', 'conversation_id', conversations);
        await deleteByIds(sb, 'adm_cot_tasks', 'conversation_id', conversations);
      }

      deleted.admCot.conversations = await deleteByFilter(
        sb,
        'adm_cot_conversations',
        "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},client_name.ilike.TEST%"
      );

      // Delete quotes and related
      const quotes = await getIds(
        sb,
        'adm_cot_quotes',
        "quoted_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},status.eq.ABANDONADA,client_name.ilike.TEST%"
      );

      if (quotes.length > 0) {
        await deleteByIds(sb, 'adm_cot_payments', 'quote_id', quotes);
        await deleteByIds(sb, 'adm_cot_recurrences', 'quote_id', quotes);
        await deleteByIds(sb, 'adm_cot_expedientes', 'quote_id', quotes);
      }

      deleted.admCot.quotes = await deleteByFilter(
        sb,
        'adm_cot_quotes',
        "quoted_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},status.eq.ABANDONADA,client_name.ilike.TEST%"
      );
    } catch (err: any) {
      errors.push(`ADM COT cleanup error: ${err.message}`);
    }

    // ========== OPERACIONES CLEANUP ==========
    try {
      const cases = await getIds(
        sb,
        'ops_cases',
        "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},ticket.ilike.TEST-%"
      );

      if (cases.length > 0) {
        await deleteByIds(sb, 'ops_case_history', 'case_id', cases);
        await deleteByIds(sb, 'ops_activity_log', 'entity_id', cases);
      }

      deleted.operaciones.cases = await deleteByFilter(
        sb,
        'ops_cases',
        "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},ticket.ilike.TEST-%"
      );

      deleted.operaciones.renewals = await deleteByFilter(
        sb,
        'ops_renewals',
        "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},ticket_number.ilike.TEST-%"
      );

      deleted.operaciones.petitions = await deleteByFilter(
        sb,
        'ops_petitions',
        "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},ticket_number.ilike.TEST-%"
      );

      // Delete email threads and messages
      const emailThreads = await getIds(
        sb,
        'ops_email_threads',
        "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},ticket_id.ilike.TEST-%,subject.ilike.TEST%"
      );

      if (emailThreads.length > 0) {
        await deleteByIds(sb, 'ops_email_messages', 'thread_id', emailThreads);
      }

      deleted.operaciones.emailThreads = await deleteByFilter(
        sb,
        'ops_email_threads',
        "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},ticket_id.ilike.TEST-%"
      );
    } catch (err: any) {
      errors.push(`Operaciones cleanup error: ${err.message}`);
    }

    // ========== CHAT CLEANUP ==========
    try {
      const threads = await getIds(
        sb,
        'chat_threads',
        "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},client_name.ilike.TEST%"
      );

      if (threads.length > 0) {
        await deleteByIds(sb, 'chat_events', 'thread_id', threads);
        await deleteByIds(sb, 'chat_messages', 'thread_id', threads);
      }

      deleted.chat.threads = await deleteByFilter(
        sb,
        'chat_threads',
        "created_at.gt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()},client_name.ilike.TEST%"
      );
    } catch (err: any) {
      errors.push(`Chat cleanup error: ${err.message}`);
    }

    // ========== LEGACY CLEANUP ==========
    try {
      deleted.legacy.cases = await deleteByFilter(
        sb,
        'cases',
        "is_test.eq.true"
      );

      deleted.legacy.emails = await deleteByFilter(
        sb,
        'inbound_emails',
        "is_test.eq.true"
      );
    } catch (err: any) {
      errors.push(`Legacy cleanup error: ${err.message}`);
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: `Limpieza completada. ${
        errors.length === 0
          ? 'Todos los datos de prueba han sido eliminados.'
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
  table: string,
  filter?: Record<string, any>
): Promise<number> {
  try {
    let query = sb.from(table).select('id', { count: 'exact', head: true });
    if (filter?.or) {
      query = query.or(filter.or);
    }
    const { count } = await query;
    return count || 0;
  } catch {
    return 0;
  }
}

async function getIds(
  sb: ReturnType<typeof createClient>,
  table: string,
  filter: string
): Promise<string[]> {
  try {
    const { data } = await sb
      .from(table)
      .select('id')
      .or(filter)
      .limit(1000);
    return (data || []).map((row: any) => row.id);
  } catch {
    return [];
  }
}

async function deleteByFilter(
  sb: ReturnType<typeof createClient>,
  table: string,
  filter: string
): Promise<number> {
  try {
    const { count } = await sb
      .from(table)
      .delete()
      .or(filter);
    return count || 0;
  } catch {
    return 0;
  }
}

async function deleteByIds(
  sb: ReturnType<typeof createClient>,
  table: string,
  column: string,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0;
  try {
    const { count } = await sb
      .from(table)
      .delete()
      .in(column, ids);
    return count || 0;
  } catch {
    return 0;
  }
}
