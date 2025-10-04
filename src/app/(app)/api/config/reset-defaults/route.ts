import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function POST() {
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

    // TODO: Restablecer configuración en base de datos a valores por defecto
    console.log('Restableciendo configuración a valores por defecto');

    return NextResponse.json({ 
      success: true, 
      message: 'Configuración restablecida a valores por defecto' 
    });
  } catch (error) {
    console.error('Error al restablecer configuración:', error);
    return NextResponse.json({ error: 'Error al restablecer configuración' }, { status: 500 });
  }
}
