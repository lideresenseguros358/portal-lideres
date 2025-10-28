import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: brokerId } = await params;
    
    // Authenticate user
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    // Check if user is master
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return NextResponse.json({ 
        ok: false, 
        error: 'Solo Master puede forzar cambio de contraseña' 
      }, { status: 403 });
    }

    // Get broker's p_id
    const supabase = await getSupabaseAdmin();
    
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('p_id, name')
      .eq('id', brokerId)
      .single();

    if (brokerError || !broker || !broker.p_id) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Broker no encontrado' 
      }, { status: 404 });
    }

    // Update profiles.must_change_password to true
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', broker.p_id);

    if (updateError) {
      console.error('Error updating must_change_password:', updateError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Error al configurar cambio de contraseña: ' + updateError.message 
      }, { status: 500 });
    }

    console.log(`[ForcePasswordChange] Master ${user.email} forced password change for broker ${broker.name} (${broker.p_id})`);

    return NextResponse.json({ 
      ok: true, 
      message: `${broker.name} deberá cambiar su contraseña en el próximo inicio de sesión` 
    });

  } catch (error: any) {
    console.error('Error in force-password-change:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Error al procesar solicitud' 
    }, { status: 500 });
  }
}
