import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Obtener todas las carpetas
export async function GET() {
  try {
    const supabase = await getSupabaseServer();

    const { data: folders, error } = await (supabase as any)
      .from('vida_assa_folders')
      .select(`
        *,
        vida_assa_files (
          id,
          is_new,
          marked_new_until
        )
      `)
      .order('display_order');

    if (error) throw error;

    // Procesar para agregar counts
    const now = new Date();
    const foldersWithCounts = folders?.map((folder: any) => {
      const files = folder.vida_assa_files || [];
      return {
        id: folder.id,
        name: folder.name,
        display_order: folder.display_order,
        created_at: folder.created_at,
        updated_at: folder.updated_at,
        files_count: files.length,
        has_new_files: files.some((f: any) => 
          f.is_new && f.marked_new_until && new Date(f.marked_new_until) > now
        )
      };
    }) || [];

    return NextResponse.json({ success: true, folders: foldersWithCounts });
  } catch (error: any) {
    console.error('Error fetching vida_assa folders:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Crear nueva carpeta
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Nombre requerido' }, { status: 400 });
    }

    // Obtener el siguiente display_order
    const { data: maxOrder } = await (supabase as any)
      .from('vida_assa_folders')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const newOrder = (maxOrder?.display_order || 0) + 1;

    const { data: folder, error } = await (supabase as any)
      .from('vida_assa_folders')
      .insert([{ name: name.trim(), display_order: newOrder }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, folder });
  } catch (error: any) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar carpeta
export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { id, name, display_order } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name.trim();
    if (display_order !== undefined) updateData.display_order = display_order;

    const { error } = await (supabase as any)
      .from('vida_assa_folders')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating folder:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar carpeta
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from('vida_assa_folders')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
