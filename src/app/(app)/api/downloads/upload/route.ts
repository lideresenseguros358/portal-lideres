import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// POST - Upload PDF a Supabase Storage (downloads)
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
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
      return NextResponse.json({ error: 'Solo Master puede subir archivos' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sectionId = formData.get('section_id') as string;

    if (!file || !sectionId) {
      return NextResponse.json({ error: 'Archivo y section_id son requeridos' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 });
    }

    const timestamp = Date.now();
    const fileName = `${sectionId}/${timestamp}-${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('descargas')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('descargas')
      .getPublicUrl(fileName);

    return NextResponse.json({ 
      success: true, 
      file_url: publicUrl,
      path: uploadData.path
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 });
  }
}
