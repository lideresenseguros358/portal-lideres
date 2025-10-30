import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { insurerId } = await request.json();

    if (!insurerId) {
      return NextResponse.json({ ok: false, error: 'ID de aseguradora requerido' }, { status: 400 });
    }

    const supabase = await getSupabaseServer();

    // Verificar autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    // Obtener aseguradora actual
    const { data: insurer, error: insurerError } = await supabase
      .from('insurers')
      .select('logo_url')
      .eq('id', insurerId)
      .single();

    if (insurerError) {
      return NextResponse.json({ ok: false, error: 'Aseguradora no encontrada' }, { status: 404 });
    }

    // Actualizar BD (remover logo_url)
    const { error: updateError } = await supabase
      .from('insurers')
      .update({ logo_url: null })
      .eq('id', insurerId);

    if (updateError) {
      console.error('Error updating database:', updateError);
      return NextResponse.json({ ok: false, error: 'Error al actualizar la base de datos' }, { status: 500 });
    }

    // Eliminar archivo de storage si existe
    if (insurer.logo_url) {
      try {
        const fileName = insurer.logo_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('insurer-logos').remove([fileName]);
        }
      } catch (error) {
        console.error('Error deleting logo file:', error);
        // No es crítico, el logo ya se removió de la BD
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Logo eliminado correctamente',
    });

  } catch (error) {
    console.error('Error in remove-logo API:', error);
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
