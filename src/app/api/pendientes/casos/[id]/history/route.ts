import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServer();
    const caseId = params.id;

    // Verificar autenticación
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener perfil para verificar rol
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isMaster = profile?.role === 'master';

    // Query de historial
    let query = supabase
      .from('case_history_events')
      .select(`
        *,
        profiles!created_by_user_id(full_name)
      `)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    // Broker solo ve eventos visibles
    if (!isMaster) {
      query = query.eq('visible_to_broker', true);
    }

    const { data: history, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(history);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
