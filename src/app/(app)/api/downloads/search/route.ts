import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Búsqueda global en descargas con tags
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    // Búsqueda con joins a section e insurer
    const { data: files, error } = await supabase
      .from('download_files')
      .select(`
        *,
        section:download_sections!download_files_section_id_fkey (
          id,
          name,
          scope,
          policy_type,
          insurer:insurers!download_sections_insurer_id_fkey (
            id,
            name
          )
        )
      `)
      .ilike('name', `%${query}%`)
      .order('name');

    if (error) throw error;

    const now = new Date();
    const results = files?.map(file => ({
      id: file.id,
      name: file.name,
      file_url: file.file_url,
      section_id: file.section?.id,
      section_name: file.section?.name || 'Sin sección',
      scope: file.section?.scope,
      policy_type: file.section?.policy_type,
      insurer_id: file.section?.insurer?.id,
      insurer_name: file.section?.insurer?.name || 'General',
      is_new: file.is_new && file.marked_new_until && new Date(file.marked_new_until) > now,
      created_at: file.created_at
    })) || [];

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Error searching downloads:', error);
    return NextResponse.json({ error: 'Error en la búsqueda' }, { status: 500 });
  }
}
