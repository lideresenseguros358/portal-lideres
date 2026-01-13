import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Obtener perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name, broker_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error obteniendo perfil:', profileError);
      return NextResponse.json(
        { error: 'Error al obtener perfil' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      role: profile?.role || 'broker',
      full_name: profile?.full_name || null,
      broker_id: profile?.broker_id || null,
      user_id: user.id
    });
  } catch (error) {
    console.error('Error en /api/profile:', error);
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    );
  }
}
