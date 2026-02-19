import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/downloads/files/by-insurer?insurer_id=xxx&exclude_section_id=yyy&search=zzz
 * Busca archivos existentes de una aseguradora para vincularlos en otra sección.
 * Retorna archivos agrupados por sección, excluyendo la sección actual.
 */
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: 'Solo Master puede realizar esta acción' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const insurerId = searchParams.get('insurer_id');
    const excludeSectionId = searchParams.get('exclude_section_id');
    const search = searchParams.get('search') || '';

    if (!insurerId) {
      return NextResponse.json({ error: 'insurer_id es requerido' }, { status: 400 });
    }

    // Obtener todas las secciones de esta aseguradora
    const { data: sections, error: sectionsError } = await supabase
      .from('download_sections')
      .select('id, name, scope, policy_type')
      .eq('insurer_id', insurerId)
      .order('name');

    if (sectionsError) throw sectionsError;

    if (!sections || sections.length === 0) {
      return NextResponse.json({ success: true, files: [] });
    }

    // Filtrar la sección actual si se proporcionó
    const sectionIds = sections
      .filter(s => s.id !== excludeSectionId)
      .map(s => s.id);

    if (sectionIds.length === 0) {
      return NextResponse.json({ success: true, files: [] });
    }

    // Obtener archivos de esas secciones
    let filesQuery = supabase
      .from('download_files')
      .select('id, name, file_url, section_id, created_at')
      .in('section_id', sectionIds)
      .order('name');

    if (search.trim()) {
      filesQuery = filesQuery.ilike('name', `%${search.trim()}%`);
    }

    const { data: files, error: filesError } = await filesQuery;

    if (filesError) throw filesError;

    // Crear mapa de secciones para enriquecer los archivos
    const sectionMap = new Map(sections.map(s => [s.id, s]));

    const enrichedFiles = (files || []).map(f => ({
      ...f,
      section_name: sectionMap.get(f.section_id)?.name || 'N/A',
      section_scope: sectionMap.get(f.section_id)?.scope || '',
      section_policy_type: sectionMap.get(f.section_id)?.policy_type || '',
    }));

    return NextResponse.json({ success: true, files: enrichedFiles });
  } catch (error) {
    console.error('Error searching insurer files:', error);
    return NextResponse.json({ error: 'Error al buscar archivos' }, { status: 500 });
  }
}
