import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// POST - Upload PDF a Supabase Storage
export async function POST(request: NextRequest) {
  try {
    console.log('========== GUIDES UPLOAD DEBUG ==========');
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[1] User authenticated:', user?.id, user?.email);
    
    if (!user) {
      console.error('[ERROR] No user authenticated');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('[2] User profile:', { id: user.id, role: profile?.role });

    if (profile?.role !== 'master') {
      console.error('[ERROR] User is not master:', profile?.role);
      return NextResponse.json({ error: 'Solo Master puede subir archivos' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sectionId = formData.get('section_id') as string;

    console.log('[3] File received:', {
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      sectionId
    });

    if (!file || !sectionId) {
      console.error('[ERROR] Missing file or section_id');
      return NextResponse.json({ error: 'Archivo y section_id son requeridos' }, { status: 400 });
    }

    // Validar que sea PDF
    if (file.type !== 'application/pdf') {
      console.error('[ERROR] Invalid file type:', file.type);
      return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 });
    }

    // Generar nombre único
    const timestamp = Date.now();
    const fileName = `${sectionId}/${timestamp}-${file.name}`;

    console.log('[4] Uploading to Storage bucket "guides":', fileName);

    // Subir a Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('guides')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('========== STORAGE RLS ERROR ==========');
      console.error('Error code:', uploadError.name);
      console.error('Error message:', uploadError.message);
      console.error('Error cause:', uploadError.cause);
      console.error('Full error:', JSON.stringify(uploadError, null, 2));
      console.error('======================================');
      throw uploadError;
    }
    
    console.log('[5] ✅ Upload successful:', uploadData.path);

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('guides')
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
