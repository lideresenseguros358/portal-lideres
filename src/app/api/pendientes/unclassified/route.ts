/**
 * API: GET /api/pendientes/unclassified
 * =======================================
 * Returns inbound_emails that are either:
 *   1. Not linked to any case (no row in case_emails)
 *   2. Linked to a case with estado_simple = 'Sin clasificar'
 *
 * Also returns the latest AI suggestion for each email if available.
 * Masters only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Role check — masters only
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch unlinked emails (processed_status = 'new' or 'error')
  // @ts-ignore - tabla nueva
  const { data: unlinkedEmails, error: unlinkedErr } = await supabase
    .from('inbound_emails')
    .select('id, message_id, from_email, from_name, subject, date_sent, attachments_count, processed_status, body_text')
    .in('processed_status', ['new', 'error'])
    .order('date_sent', { ascending: false })
    .limit(50);

  // Fetch emails linked to 'Sin clasificar' cases
  // @ts-ignore - tabla nueva
  const { data: sinClasificarCases } = await supabase
    .from('cases')
    .select('id, ticket, estado_simple, created_at, detected_broker_email, ai_classification, ai_confidence')
    .eq('estado_simple', 'Sin clasificar')
    .order('created_at', { ascending: false })
    .limit(50);

  // Get AI suggestions for unlinked emails
  const messageIds = (unlinkedEmails || []).map((e: any) => e.message_id).filter(Boolean);
  let aiSuggestions: any[] = [];
  if (messageIds.length > 0) {
    // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
    const { data: suggestions } = await (supabase as any)
      .from('pend_ai_classifications')
      .select('id, message_id, json_result, created_at, applied')
      .in('message_id', messageIds)
      .eq('applied', false)
      .order('created_at', { ascending: false });

    aiSuggestions = suggestions || [];
  }

  // Build response
  const suggestionsMap = new Map<string, any>();
  for (const s of aiSuggestions) {
    if (!suggestionsMap.has(s.message_id)) {
      suggestionsMap.set(s.message_id, s);
    }
  }

  const unlinkedWithSuggestions = (unlinkedEmails || []).map((email: any) => ({
    ...email,
    ai_suggestion: suggestionsMap.get(email.message_id) || null,
  }));

  return NextResponse.json({
    unlinked_emails: unlinkedWithSuggestions,
    sin_clasificar_cases: sinClasificarCases || [],
  });
}
