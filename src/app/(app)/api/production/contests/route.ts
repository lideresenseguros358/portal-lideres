import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    
    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener de app_settings
    const { data: assaData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'production.contests.assa')
      .single();

    const { data: convivioData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'production.contests.convivio')
      .single();

    const assaConfig = (typeof assaData?.value === 'object' && assaData?.value !== null) 
      ? assaData.value as { start_month: number; end_month: number; goal: number; goal_double?: number; enable_double_goal?: boolean; year?: number; last_reset_date?: string }
      : { start_month: 1, end_month: 12, goal: 250000, goal_double: 400000, enable_double_goal: false, year: new Date().getFullYear(), last_reset_date: null };

    const convivioConfig = (typeof convivioData?.value === 'object' && convivioData?.value !== null)
      ? convivioData.value as { start_month: number; end_month: number; goal: number; goal_double?: number; year?: number; last_reset_date?: string }
      : { start_month: 1, end_month: 6, goal: 150000, goal_double: 250000, year: new Date().getFullYear(), last_reset_date: null };

    const contests = {
      assa: {
        name: 'Concurso ASSA',
        ...assaConfig
      },
      convivio: {
        name: 'Convivio LISSA',
        ...convivioConfig
      }
    };

    return NextResponse.json({ success: true, data: contests });
  } catch (error) {
    console.error('Error al obtener concursos:', error);
    return NextResponse.json({ error: 'Error al obtener concursos' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    // Verificar autenticación y rol Master
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const body = await request.json();
    const { assa, convivio } = body;

    // Validaciones
    if (assa) {
      if (assa.start_month < 1 || assa.start_month > 12 ||
          assa.end_month < 1 || assa.end_month > 12 ||
          assa.start_month > assa.end_month) {
        return NextResponse.json({ error: 'Meses inválidos para ASSA' }, { status: 400 });
      }
      if (typeof assa.goal !== 'number' || assa.goal <= 0) {
        return NextResponse.json({ error: 'Meta ASSA inválida' }, { status: 400 });
      }
    }

    if (convivio) {
      if (convivio.start_month < 1 || convivio.start_month > 12 ||
          convivio.end_month < 1 || convivio.end_month > 12 ||
          convivio.start_month > convivio.end_month) {
        return NextResponse.json({ error: 'Meses inválidos para Convivio' }, { status: 400 });
      }
      if (typeof convivio.goal !== 'number' || convivio.goal <= 0) {
        return NextResponse.json({ error: 'Meta Convivio inválida' }, { status: 400 });
      }
    }

    // Guardar ASSA
    // Nota: app_settings solo tiene 3 columnas: key, value, updated_at
    if (assa) {
      // Obtener configuración actual para preservar year y last_reset_date si no se envían
      const { data: currentAssa } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'production.contests.assa')
        .single();

      const currentAssaConfig = (typeof currentAssa?.value === 'object' && currentAssa?.value !== null)
        ? currentAssa.value as any
        : {};

      const { error: assaError } = await supabase
        .from('app_settings')
        .upsert({
          key: 'production.contests.assa',
          value: {
            start_month: assa.start_month,
            end_month: assa.end_month,
            goal: assa.goal,
            goal_double: assa.goal_double ?? currentAssaConfig.goal_double ?? 400000,
            enable_double_goal: assa.enable_double_goal ?? currentAssaConfig.enable_double_goal ?? false,
            year: assa.year ?? currentAssaConfig.year ?? new Date().getFullYear(),
            last_reset_date: assa.last_reset_date ?? currentAssaConfig.last_reset_date ?? null
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (assaError) {
        console.error('Error saving ASSA:', assaError);
        return NextResponse.json({ error: 'Error al guardar Concurso ASSA' }, { status: 500 });
      }
    }

    // Guardar Convivio
    if (convivio) {
      // Obtener configuración actual para preservar year y last_reset_date si no se envían
      const { data: currentConvivio } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'production.contests.convivio')
        .single();

      const currentConvivioConfig = (typeof currentConvivio?.value === 'object' && currentConvivio?.value !== null)
        ? currentConvivio.value as any
        : {};

      const { error: convivioError } = await supabase
        .from('app_settings')
        .upsert({
          key: 'production.contests.convivio',
          value: {
            start_month: convivio.start_month,
            end_month: convivio.end_month,
            goal: convivio.goal,
            goal_double: convivio.goal_double ?? currentConvivioConfig.goal_double ?? 250000,
            year: convivio.year ?? currentConvivioConfig.year ?? new Date().getFullYear(),
            last_reset_date: convivio.last_reset_date ?? currentConvivioConfig.last_reset_date ?? null
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (convivioError) {
        console.error('Error saving Convivio:', convivioError);
        return NextResponse.json({ error: 'Error al guardar Convivio LISSA' }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Concursos actualizados exitosamente' 
    });
  } catch (error) {
    console.error('Error al actualizar concursos:', error);
    return NextResponse.json({ error: 'Error al actualizar concursos' }, { status: 500 });
  }
}

// POST: Resetear concursos (marca nueva fecha de inicio, NO borra datos de producción)
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    // Verificar autenticación y rol Master
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const body = await request.json();
    const { contest } = body; // 'assa' | 'convivio' | 'both'

    const resetDate = new Date().toISOString();
    const currentYear = new Date().getFullYear();

    if (contest === 'assa' || contest === 'both') {
      // Obtener configuración actual
      const { data: currentAssa } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'production.contests.assa')
        .single();

      const currentAssaConfig = (typeof currentAssa?.value === 'object' && currentAssa?.value !== null)
        ? currentAssa.value as any
        : {};

      // Actualizar con nueva fecha de reset y año
      await supabase
        .from('app_settings')
        .upsert({
          key: 'production.contests.assa',
          value: {
            ...currentAssaConfig,
            year: currentYear,
            last_reset_date: resetDate
          },
          updated_at: resetDate
        }, {
          onConflict: 'key'
        });
    }

    if (contest === 'convivio' || contest === 'both') {
      // Obtener configuración actual
      const { data: currentConvivio } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'production.contests.convivio')
        .single();

      const currentConvivioConfig = (typeof currentConvivio?.value === 'object' && currentConvivio?.value !== null)
        ? currentConvivio.value as any
        : {};

      // Actualizar con nueva fecha de reset y año
      await supabase
        .from('app_settings')
        .upsert({
          key: 'production.contests.convivio',
          value: {
            ...currentConvivioConfig,
            year: currentYear,
            last_reset_date: resetDate
          },
          updated_at: resetDate
        }, {
          onConflict: 'key'
        });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Concurso(s) reseteado(s) exitosamente',
      reset_date: resetDate 
    });
  } catch (error) {
    console.error('Error al resetear concursos:', error);
    return NextResponse.json({ error: 'Error al resetear concursos' }, { status: 500 });
  }
}
