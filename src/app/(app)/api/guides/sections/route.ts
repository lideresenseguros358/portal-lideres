import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Obtener todas las secciones con count de archivos
export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener secciones con count de archivos y archivos nuevos
    const { data: sections, error } = await supabase
      .from('guide_sections')
      .select(`
        *,
        guide_files (
          id,
          is_new,
          marked_new_until
        )
      `)
      .order('display_order');

    if (error) throw error;

    // Procesar para agregar counts
    const sectionsWithCounts = sections?.map(section => {
      const files = section.guide_files || [];
      const now = new Date();
      
      return {
        id: section.id,
        name: section.name,
        display_order: section.display_order,
        created_at: section.created_at,
        updated_at: section.updated_at,
        files_count: files.length,
        has_new_files: files.some((f: any) => 
          f.is_new && f.marked_new_until && new Date(f.marked_new_until) > now
        )
      };
    }) || [];

    return NextResponse.json({ 
      success: true, 
      sections: sectionsWithCounts 
    });
  } catch (error) {
    console.error('Error fetching guide sections:', error);
    return NextResponse.json({ error: 'Error al obtener secciones' }, { status: 500 });
  }
}

// POST - Crear nueva sección (solo Master)
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar rol Master
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return NextResponse.json({ error: 'Solo Master puede crear secciones' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 });
    }

    // Obtener el último orden
    const { data: lastSection } = await supabase
      .from('guide_sections')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const newOrder = (lastSection?.display_order || 0) + 1;

    // Crear sección
    const { data: section, error } = await supabase
      .from('guide_sections')
      .insert([{
        name,
        display_order: newOrder
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      section 
    });
  } catch (error) {
    console.error('Error creating guide section:', error);
    return NextResponse.json({ error: 'Error al crear sección' }, { status: 500 });
  }
}

// PUT - Actualizar sección (renombrar, reordenar)
export async function PUT(request: NextRequest) {
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
      return NextResponse.json({ error: 'Solo Master puede editar secciones' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, display_order } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (display_order !== undefined) updates.display_order = display_order;

    const { data: section, error } = await supabase
      .from('guide_sections')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      section 
    });
  } catch (error) {
    console.error('Error updating guide section:', error);
    return NextResponse.json({ error: 'Error al actualizar sección' }, { status: 500 });
  }
}

// DELETE - Eliminar sección (solo Master)
export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ error: 'Solo Master puede eliminar secciones' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // Verificar si tiene archivos
    const { data: files } = await supabase
      .from('guide_files')
      .select('id')
      .eq('section_id', id);

    if (files && files.length > 0) {
      return NextResponse.json({ 
        error: `No se puede eliminar. La sección tiene ${files.length} archivo(s)` 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('guide_sections')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting guide section:', error);
    return NextResponse.json({ error: 'Error al eliminar sección' }, { status: 500 });
  }
}
