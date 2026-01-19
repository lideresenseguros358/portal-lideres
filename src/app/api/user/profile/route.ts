import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    
    // Obtener usuario autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    // Obtener perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Perfil no encontrado' },
        { status: 404 }
      );
    }

    // Si es broker, obtener datos del broker
    let brokerData = null;
    if (profile.role === 'broker') {
      const { data: broker } = await supabase
        .from('brokers')
        .select('id, name, email, commission_override')
        .eq('p_id', user.id)
        .single();
      
      brokerData = broker;
    }

    return NextResponse.json({
      profile,
      broker: brokerData,
    });
  } catch (error) {
    console.error('Error en /api/user/profile:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
