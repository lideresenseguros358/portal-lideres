import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const insurerId = formData.get('insurerId') as string;
    const insurerName = formData.get('insurerName') as string;

    if (!file || !insurerId) {
      return NextResponse.json({ ok: false, error: 'Datos incompletos' }, { status: 400 });
    }

    const supabase = await getSupabaseServer();

    // Verificar autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'Debe ser una imagen' }, { status: 400 });
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'La imagen no debe superar 5MB' }, { status: 400 });
    }

    // Obtener aseguradora actual para ver si tiene logo previo
    const { data: insurer, error: insurerError } = await supabase
      .from('insurers')
      .select('logo_url')
      .eq('id', insurerId)
      .single();

    if (insurerError) {
      return NextResponse.json({ ok: false, error: 'Aseguradora no encontrada' }, { status: 404 });
    }

    // Nombre del archivo: insurer-name-timestamp.ext
    const fileExt = file.name.split('.').pop();
    const fileName = `${insurerName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.${fileExt}`;

    // Convertir File a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('insurer-logos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
      return NextResponse.json({ ok: false, error: 'Error al subir el archivo' }, { status: 500 });
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('insurer-logos')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // Actualizar BD
    const { error: updateError } = await supabase
      .from('insurers')
      .update({ logo_url: publicUrl })
      .eq('id', insurerId);

    if (updateError) {
      console.error('Error updating database:', updateError);
      // Intentar eliminar el archivo subido
      await supabase.storage.from('insurer-logos').remove([fileName]);
      return NextResponse.json({ ok: false, error: 'Error al actualizar la base de datos' }, { status: 500 });
    }

    // Eliminar logo anterior si existe
    if (insurer.logo_url) {
      try {
        const oldFileName = insurer.logo_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage.from('insurer-logos').remove([oldFileName]);
        }
      } catch (error) {
        console.error('Error deleting old logo:', error);
        // No es crítico, continuamos
      }
    }

    return NextResponse.json({
      ok: true,
      logoUrl: publicUrl,
      message: 'Logo actualizado correctamente',
    });

  } catch (error) {
    console.error('Error in upload-logo API:', error);
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
