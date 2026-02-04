import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Obtener archivos de una carpeta
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folder_id');

    if (!folderId) {
      return NextResponse.json({ success: false, error: 'folder_id requerido' }, { status: 400 });
    }

    const supabase = await getSupabaseServer();

    const { data: files, error } = await (supabase as any)
      .from('vida_assa_files')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, files: files || [] });
  } catch (error: any) {
    console.error('Error fetching vida_assa files:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Subir archivo
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const { folder_id, name, file_url, file_size, file_type, is_new, marked_new_until } = await request.json();

    if (!folder_id || !name || !file_url) {
      return NextResponse.json({ success: false, error: 'Datos incompletos' }, { status: 400 });
    }

    const { data: file, error } = await (supabase as any)
      .from('vida_assa_files')
      .insert([{
        folder_id,
        name,
        file_url,
        file_size,
        file_type,
        is_new: is_new || false,
        marked_new_until,
        uploaded_by: user.id
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, file });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar archivo
export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { id, name, is_new, marked_new_until } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (is_new !== undefined) updateData.is_new = is_new;
    if (marked_new_until !== undefined) updateData.marked_new_until = marked_new_until;

    const { error } = await (supabase as any)
      .from('vida_assa_files')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating file:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar archivo
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    // Obtener el file_url antes de eliminar para borrar de storage
    const { data: file } = await (supabase as any)
      .from('vida_assa_files')
      .select('file_url')
      .eq('id', id)
      .single();

    const { error } = await (supabase as any)
      .from('vida_assa_files')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Intentar eliminar del storage (opcional, no falla si no se puede)
    if (file?.file_url) {
      try {
        const pathMatch = file.file_url.match(/vida-assa\/(.+)$/);
        if (pathMatch) {
          await supabase.storage
            .from('vida-assa')
            .remove([pathMatch[1]]);
        }
      } catch (storageError) {
        console.warn('Error deleting from storage:', storageError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
