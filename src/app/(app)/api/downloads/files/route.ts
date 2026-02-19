import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Obtener archivos de descargas (similar a guides pero con más filtros)
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

    // Obtener archivos (created_by apunta a auth.users, no profiles)
    const { data: files, error } = await supabase
      .from('download_files')
      .select('*')
      .eq('section_id', sectionId)
      .order('display_order');

    if (error) throw error;

    const now = new Date();
    const filesWithStatus = files?.map((file: any) => ({
      ...file,
      show_new_badge: file.is_new && file.marked_new_until && new Date(file.marked_new_until) > now
    })) || [];

    return NextResponse.json({ success: true, files: filesWithStatus });
  } catch (error) {
    console.error('Error fetching download files:', error);
    return NextResponse.json({ error: 'Error al obtener archivos' }, { status: 500 });
  }
}

// POST, PUT, DELETE - Igual que guides/files pero con download_files
export async function POST(request: NextRequest) {
  try {
    console.log('========== DOWNLOAD FILE INSERT DEBUG ==========');
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    console.log('User ID:', user?.id);
    
    if (!user) {
      console.error('[ERROR] No user authenticated');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('Profile role:', profile?.role);

    if (profile?.role !== 'master') {
      console.error('[ERROR] User is not master:', profile?.role);
      return NextResponse.json({ error: 'Solo Master puede subir archivos' }, { status: 403 });
    }

    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    const { section_id, name, file_url, mark_as_new = true, duplicate_in = [], link_changes = false } = body;

    console.log('Parsed fields:', {
      section_id,
      name,
      file_url,
      mark_as_new,
      duplicate_in,
      link_changes
    });

    if (!section_id || !name || !file_url) {
      console.error('[ERROR] Missing required fields:', {
        has_section_id: !!section_id,
        has_name: !!name,
        has_file_url: !!file_url
      });
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const markedNewUntil = mark_as_new ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null;

    const { data: lastFile } = await supabase
      .from('download_files')
      .select('display_order')
      .eq('section_id', section_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const newOrder = (lastFile?.display_order || 0) + 1;

    const { data: file, error } = await supabase
      .from('download_files')
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

    const linkedIds: string[] = [];
    if (duplicate_in.length > 0) {
      for (const targetSectionId of duplicate_in) {
        const { data: lastTargetFile } = await supabase
          .from('download_files')
          .select('display_order')
          .eq('section_id', targetSectionId)
          .order('display_order', { ascending: false })
          .limit(1)
          .single();

        const targetOrder = (lastTargetFile?.display_order || 0) + 1;

        const { data: duplicateFile } = await supabase
          .from('download_files')
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
          await supabase
            .from('download_file_links')
            .insert([{
              source_file_id: file.id,
              linked_file_id: duplicateFile.id
            }]);

          linkedIds.push(duplicateFile.id);
        }
      }
    }

    return NextResponse.json({ success: true, file, linked_ids: linkedIds });
  } catch (error) {
    console.error('Error creating download file:', error);
    return NextResponse.json({ error: 'Error al crear archivo' }, { status: 500 });
  }
}

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
        result = await supabase
          .from('download_files')
          .update({ name: params.name })
          .eq('id', id)
          .select()
          .single();
        break;

      case 'replace':
        const markedNewUntilReplace = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        result = await supabase
          .from('download_files')
          .update({ 
            file_url: params.file_url,
            is_new: true,
            marked_new_until: markedNewUntilReplace
          })
          .eq('id', id)
          .select()
          .single();

        const { data: links } = await supabase
          .from('download_file_links')
          .select('linked_file_id')
          .eq('source_file_id', id);

        if (links && links.length > 0) {
          await supabase
            .from('download_files')
            .update({ 
              file_url: params.file_url,
              is_new: true,
              marked_new_until: markedNewUntilReplace
            })
            .in('id', links.map(l => l.linked_file_id));
        }
        break;

      case 'move':
        result = await supabase
          .from('download_files')
          .update({ section_id: params.section_id })
          .eq('id', id)
          .select()
          .single();
        break;

      case 'reorder':
        result = await supabase
          .from('download_files')
          .update({ display_order: params.display_order })
          .eq('id', id)
          .select()
          .single();
        break;

      case 'create_link':
        // Crear vínculo entre archivo fuente y archivo vinculado
        if (!params.source_file_id || !params.linked_file_id) {
          return NextResponse.json({ error: 'source_file_id y linked_file_id son requeridos' }, { status: 400 });
        }
        const { error: linkError } = await supabase
          .from('download_file_links')
          .insert([{
            source_file_id: params.source_file_id,
            linked_file_id: params.linked_file_id
          }]);
        if (linkError) throw linkError;
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    if (result.error) throw result.error;

    return NextResponse.json({ success: true, file: result.data });
  } catch (error) {
    console.error('Error updating download file:', error);
    return NextResponse.json({ error: 'Error al actualizar archivo' }, { status: 500 });
  }
}

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

    const { data: links } = await supabase
      .from('download_file_links')
      .select('linked_file_id')
      .eq('source_file_id', id);

    const affectedLinks = links?.length || 0;

    const { error } = await supabase
      .from('download_files')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, affected_links: affectedLinks });
  } catch (error) {
    console.error('Error deleting download file:', error);
    return NextResponse.json({ error: 'Error al eliminar archivo' }, { status: 500 });
  }
}
