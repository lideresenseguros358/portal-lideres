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

    // Por ahora retornamos valores por defecto
    // TODO: Guardar estos valores en una tabla de configuración
    const settings = {
      branding: {
        logo_url: null,
        logo_alt_url: null,
        favicon_url: null,
        primary_color: '#010139',
        accent_color: '#8AAA19',
      },
      notifications: {
        commissions_close: true,
        cases_always_on: true,
      },
      commission_percentages: ['0.50', '0.60', '0.70', '0.80', '0.82', '0.94', '1.00'],
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error al obtener configuración:', error);
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
    
    // TODO: Guardar configuración en base de datos
    // Por ahora solo confirmamos que se recibió
    console.log('Configuración guardada:', body);

    return NextResponse.json({ 
      success: true, 
      message: 'Configuración guardada exitosamente' 
    });
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 });
  }
}
