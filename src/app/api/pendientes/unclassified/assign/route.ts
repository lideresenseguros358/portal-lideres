/**
 * API: POST /api/pendientes/unclassified/assign
 * ================================================
 * Assign an unlinked email to an existing case, or create a new case from it.
 * Also supports archiving (marking as ignored).
 *
 * Body:
 *   action: 'assign' | 'create' | 'archive'
 *   email_id: string (inbound_emails.id)
 *   case_id?: string (required when action='assign')
 *   classification_id?: string (pend_ai_classifications.id to mark as applied)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { action, email_id, case_id, classification_id, section, client_name, national_id, management_type, ctype, policy_number, notes } = body;

  if (!email_id || !action) {
    return NextResponse.json({ error: 'Missing email_id or action' }, { status: 400 });
  }

  try {
    if (action === 'assign') {
      if (!case_id) {
        return NextResponse.json({ error: 'case_id required for assign' }, { status: 400 });
      }

      // Link email to existing case
      // @ts-ignore
      await supabase.from('case_emails').insert({
        case_id,
        inbound_email_id: email_id,
        linked_by: 'master',
        visible_to_broker: true,
      });

      // Update email status
      // @ts-ignore
      await supabase
        .from('inbound_emails')
        .update({ processed_status: 'linked', processed_at: new Date().toISOString() })
        .eq('id', email_id);

      // History event
      await supabase.from('case_history_events').insert({
        case_id,
        event_type: 'email_manually_linked',
        payload: { email_id, linked_by: user.id },
        created_by_role: 'master',
        visible_to_broker: true,
      });

      // Mark AI classification as applied if provided
      if (classification_id) {
        // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
        await (supabase as any)
          .from('pend_ai_classifications')
          .update({ applied: true, applied_by: user.id, applied_at: new Date().toISOString() })
          .eq('id', classification_id);
      }

      return NextResponse.json({ success: true, action: 'assigned', case_id });

    } else if (action === 'create') {
      // Create a new case from the email with status 'Sin clasificar'
      // @ts-ignore
      const { data: email } = await supabase
        .from('inbound_emails')
        .select('*')
        .eq('id', email_id)
        .single();

      if (!email) {
        return NextResponse.json({ error: 'Email not found' }, { status: 404 });
      }

      const effectiveSection = section || 'SIN_CLASIFICAR';
      const isClassified = effectiveSection !== 'SIN_CLASIFICAR';

      const { data: newCase, error: caseErr } = await supabase
        .from('cases')
        .insert({
          section: effectiveSection,
          status: 'PENDIENTE_REVISION',
          client_name: client_name || null,
          national_id: national_id || null,
          management_type: management_type || null,
          ctype: ctype || null,
          policy_number: policy_number || null,
          notes: notes || `Correo de: ${email.from_email}\nAsunto: ${email.subject}`,
          canal: 'EMAIL',
          estado_simple: isClassified ? 'Nuevo' : 'Sin clasificar',
          ramo_bucket: isClassified ? effectiveSection.toLowerCase() : 'desconocido',
          detected_broker_email: email.from_email,
          ai_classification: null,
          ai_confidence: 0,
          special_flags: ['manual_creation'],
          is_deleted: false,
          seen_by_broker: false,
        })
        .select()
        .single();

      if (caseErr || !newCase) {
        return NextResponse.json({ error: `Error creating case: ${caseErr?.message}` }, { status: 500 });
      }

      // Link email
      // @ts-ignore
      await supabase.from('case_emails').insert({
        case_id: newCase.id,
        inbound_email_id: email_id,
        linked_by: 'master',
        visible_to_broker: true,
      });

      // @ts-ignore
      await supabase
        .from('inbound_emails')
        .update({ processed_status: 'linked', processed_at: new Date().toISOString() })
        .eq('id', email_id);

      // History
      await supabase.from('case_history_events').insert({
        case_id: newCase.id,
        event_type: 'created',
        payload: { origin: 'manual_from_unclassified', email_id, created_by: user.id },
        created_by_role: 'master',
        visible_to_broker: true,
      });

      return NextResponse.json({ success: true, action: 'created', case_id: newCase.id });

    } else if (action === 'archive') {
      // Mark email as archived/ignored
      // @ts-ignore
      await supabase
        .from('inbound_emails')
        .update({ processed_status: 'archived', processed_at: new Date().toISOString() })
        .eq('id', email_id);

      return NextResponse.json({ success: true, action: 'archived' });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[UNCLASSIFIED ASSIGN]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
