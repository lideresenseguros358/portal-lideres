import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const supabase = await getSupabaseServer();

    // Verificar autenticación
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener correos vinculados al caso
    // @ts-ignore - tablas nuevas, database.types.ts pendiente de actualizar
    const { data: emails, error } = await supabase
      .from('case_emails')
      .select(`
        *,
        inbound_emails(
          id,
          message_id,
          from_email,
          from_name,
          subject,
          subject_normalized,
          date_sent,
          body_text_normalized,
          attachments_count
        )
      `)
      .eq('case_id', caseId)
      .eq('visible_to_broker', true)
      .order('linked_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(emails);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
