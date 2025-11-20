import { NextRequest, NextResponse } from 'next/server';
import { updateImportantDates, type ImportantDatesData } from '@/lib/important-dates';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    // Verificar que sea Master
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (!profile || profile.role !== 'master') {
      return NextResponse.json(
        { error: 'Solo Master puede actualizar las fechas' },
        { status: 403 }
      );
    }
    
    const dates: ImportantDatesData = await request.json();
    
    const result = await updateImportantDates(dates, user.id);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al actualizar las fechas' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error updating important dates:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
