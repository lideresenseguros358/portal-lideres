import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Obtener archivos de una sección
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get('section_id');

    if (!sectionId) {
      return NextResponse.json({ error: 'section_id es requerido' }, { status: 400 });
    }

    // Obtener archivos con info del creador
    const { data: files, error } = await supabase
      .from('guide_files')
      .select(`
        *,
        created_by_profile:profiles (full_name)
      `)
      .eq('section_id', sectionId)
      .order('display_order');

    if (error) throw error;

    // Procesar para verificar badges "Nuevo"
    const now = new Date();
    const filesWithStatus = files?.map((file: any) => ({
      ...file,
      created_by_name: file.created_by_profile?.full_name || 'Sistema',
      show_new_badge: file.is_new && file.marked_new_until && new Date(file.marked_new_until) > now
    })) || [];

    return NextResponse.json({ 
      success: true, 
      files: filesWithStatus 
    });
  } catch (error) {
    console.error('Error fetching guide files:', error);
    return NextResponse.json({ error: 'Error al obtener archivos' }, { status: 500 });
  }
}

// POST - Crear nuevo archivo (solo Master)
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

    const body = await request.json();
    const { 
      section_id, 
      name, 
      file_url, 
      mark_as_new = true,
      duplicate_in = [],
      link_changes = false 
    } = body;

    if (!section_id || !name || !file_url) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Calcular marked_new_until (48 horas)
    const markedNewUntil = mark_as_new ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null;

    // Obtener último orden
    const { data: lastFile } = await supabase
      .from('guide_files')
      .select('display_order')
      .eq('section_id', section_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const newOrder = (lastFile?.display_order || 0) + 1;

    // Crear archivo principal
    const { data: file, error } = await supabase
      .from('guide_files')
      .insert([{
        section_id,
        name,
        file_url,
        display_order: newOrder,
        created_by: user.id,
        is_new: mark_as_new,
        marked_new_until: markedNewUntil
      }])
      .select()
      .single();

    if (error) throw error;

    // Crear duplicados si se especificó
    const linkedIds: string[] = [];
    if (duplicate_in.length > 0) {
      for (const targetSectionId of duplicate_in) {
        // Obtener orden para la sección destino
        const { data: lastTargetFile } = await supabase
          .from('guide_files')
          .select('display_order')
          .eq('section_id', targetSectionId)
          .order('display_order', { ascending: false })
          .limit(1)
          .single();

        const targetOrder = (lastTargetFile?.display_order || 0) + 1;

        // Crear duplicado
        const { data: duplicateFile } = await supabase
          .from('guide_files')
          .insert([{
            section_id: targetSectionId,
            name,
            file_url,
            display_order: targetOrder,
            created_by: user.id,
            is_new: mark_as_new,
            marked_new_until: markedNewUntil
          }])
          .select('id')
          .single();

        if (duplicateFile && link_changes) {
          // Crear vínculo si está activado
          await supabase
            .from('guide_file_links')
            .insert([{
              source_file_id: file.id,
              linked_file_id: duplicateFile.id
            }]);

          linkedIds.push(duplicateFile.id);
        }
      }
    }

    // TODO: Crear notificación para brokers
    // await createNotification(...)

    return NextResponse.json({ 
      success: true, 
      file,
      linked_ids: linkedIds 
    });
  } catch (error) {
    console.error('Error creating guide file:', error);
    return NextResponse.json({ error: 'Error al crear archivo' }, { status: 500 });
  }
}

// PUT - Actualizar archivo (renombrar, reemplazar, mover)
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
      return NextResponse.json({ error: 'Solo Master puede editar archivos' }, { status: 403 });
    }

    const body = await request.json();
    const { id, action, ...params } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'ID y action son requeridos' }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'rename':
        if (!params.name) {
          return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 });
        }
        result = await supabase
          .from('guide_files')
          .update({ name: params.name })
          .eq('id', id)
          .select()
          .single();
        break;

      case 'replace':
        if (!params.file_url) {
          return NextResponse.json({ error: 'file_url es requerido' }, { status: 400 });
        }
        // Marcar como actualizado (badge "Nuevo")
        const markedNewUntilReplace = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        result = await supabase
          .from('guide_files')
          .update({ 
            file_url: params.file_url,
            is_new: true,
            marked_new_until: markedNewUntilReplace
          })
          .eq('id', id)
          .select()
          .single();

        // Si tiene vínculos, actualizar también
        const { data: links } = await supabase
          .from('guide_file_links')
          .select('linked_file_id')
          .eq('source_file_id', id);

        if (links && links.length > 0) {
          await supabase
            .from('guide_files')
            .update({ 
              file_url: params.file_url,
              is_new: true,
              marked_new_until: markedNewUntilReplace
            })
            .in('id', links.map(l => l.linked_file_id));
        }
        break;

      case 'move':
        if (!params.section_id) {
          return NextResponse.json({ error: 'section_id es requerido' }, { status: 400 });
        }
        result = await supabase
          .from('guide_files')
          .update({ section_id: params.section_id })
          .eq('id', id)
          .select()
          .single();
        break;

      case 'reorder':
        if (params.display_order === undefined) {
          return NextResponse.json({ error: 'display_order es requerido' }, { status: 400 });
        }
        result = await supabase
          .from('guide_files')
          .update({ display_order: params.display_order })
          .eq('id', id)
          .select()
          .single();
        break;

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    if (result.error) throw result.error;

    return NextResponse.json({ 
      success: true, 
      file: result.data 
    });
  } catch (error) {
    console.error('Error updating guide file:', error);
    return NextResponse.json({ error: 'Error al actualizar archivo' }, { status: 500 });
  }
}

// DELETE - Eliminar archivo (solo Master)
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
      return NextResponse.json({ error: 'Solo Master puede eliminar archivos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // Verificar si tiene vínculos
    const { data: links } = await supabase
      .from('guide_file_links')
      .select('linked_file_id')
      .eq('source_file_id', id);

    const affectedLinks = links?.length || 0;

    // Eliminar archivo (CASCADE eliminará vínculos automáticamente)
    const { error } = await supabase
      .from('guide_files')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // TODO: Eliminar archivo de Storage
    // await supabase.storage.from('guides-pdfs').remove([file_path])

    return NextResponse.json({ 
      success: true,
      affected_links: affectedLinks 
    });
  } catch (error) {
    console.error('Error deleting guide file:', error);
    return NextResponse.json({ error: 'Error al eliminar archivo' }, { status: 500 });
  }
}
