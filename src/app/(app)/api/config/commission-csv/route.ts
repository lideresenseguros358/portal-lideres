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
      columns: [
        'Nombre',
        'Cédula',
        'Banco',
        'Tipo Cuenta',
        'Número Cuenta',
        'Monto',
      ],
      send_notifications: true,
      pending_days: 90,
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error al obtener configuración CSV:', error);
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
    const { columns, send_notifications, pending_days } = body;

    // Validaciones
    if (!Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: 'Las columnas deben ser un array no vacío' }, { status: 400 });
    }

    if (typeof send_notifications !== 'boolean') {
      return NextResponse.json({ error: 'send_notifications debe ser un booleano' }, { status: 400 });
    }

    if (typeof pending_days !== 'number' || pending_days < 1 || pending_days > 365) {
      return NextResponse.json({ error: 'pending_days debe ser un número entre 1 y 365' }, { status: 400 });
    }

    // TODO: Guardar en base de datos
    console.log('Configuración CSV guardada:', { columns, send_notifications, pending_days });

    return NextResponse.json({ 
      success: true, 
      message: 'Configuración de comisiones guardada exitosamente',
      data: { columns, send_notifications, pending_days }
    });
  } catch (error) {
    console.error('Error al guardar configuración CSV:', error);
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 });
  }
}
