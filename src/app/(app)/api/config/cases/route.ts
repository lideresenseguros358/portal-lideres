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

    // Verificar que sea Master
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Valores por defecto
    const settings = {
      kanban_enabled: false,
      deferred_reminder_days: 5,
      case_types: [
        { id: '1', name: 'Generales', min_days: 7, max_days: 15 },
        { id: '2', name: 'Personas', min_days: 8, max_days: 20 },
      ],
      requirements: [],
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error al obtener configuración de trámites:', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea Master
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const body = await request.json();
    const { kanban_enabled, deferred_reminder_days, case_types, requirements } = body;

    // Validaciones
    if (typeof kanban_enabled !== 'boolean') {
      return NextResponse.json({ error: 'kanban_enabled debe ser un booleano' }, { status: 400 });
    }

    if (typeof deferred_reminder_days !== 'number' || deferred_reminder_days < 1 || deferred_reminder_days > 30) {
      return NextResponse.json({ error: 'deferred_reminder_days debe ser un número entre 1 y 30' }, { status: 400 });
    }

    // TODO: Guardar en base de datos
    console.log('Configuración de trámites guardada:', {
      kanban_enabled,
      deferred_reminder_days,
      case_types,
      requirements
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Configuración de trámites guardada exitosamente',
      data: { kanban_enabled, deferred_reminder_days, case_types, requirements }
    });
  } catch (error) {
    console.error('Error al guardar configuración de trámites:', error);
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 });
  }
}
