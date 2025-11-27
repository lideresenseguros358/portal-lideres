import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Obtener aseguradoras de un tipo de póliza específico
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const policyType = searchParams.get('policy_type');

    if (!scope || !policyType) {
      return NextResponse.json({ error: 'scope y policy_type son requeridos' }, { status: 400 });
    }

    // Obtener aseguradoras del sistema que tienen secciones en este tipo de póliza
    const { data: sections, error: sectionsError } = await supabase
      .from('download_sections')
      .select('insurer_id')
      .eq('scope', scope)
      .eq('policy_type', policyType)
      .not('insurer_id', 'is', null);

    if (sectionsError) throw sectionsError;

    // Extraer IDs únicos (filtrar nulls)
    const insurerIds = [...new Set(
      sections?.map(s => s.insurer_id).filter((id): id is string => id !== null) || []
    )];

    if (insurerIds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        insurers: [] 
      });
    }

    // Obtener info de aseguradoras
    const { data: insurers, error: insurersError } = await supabase
      .from('insurers')
      .select('id, name, logo_url')
      .in('id', insurerIds)
      .order('name');

    if (insurersError) throw insurersError;

    // Contar secciones por aseguradora
    const insurersWithCounts = insurers?.map(insurer => {
      const count = sections?.filter(s => s.insurer_id === insurer.id).length || 0;
      return {
        ...insurer,
        sections_count: count
      };
    }) || [];

    return NextResponse.json({ 
      success: true, 
      insurers: insurersWithCounts 
    });
  } catch (error) {
    console.error('Error fetching insurers:', error);
    return NextResponse.json({ error: 'Error al obtener aseguradoras' }, { status: 500 });
  }
}

// POST - Agregar aseguradora a un tipo de póliza
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
      return NextResponse.json({ error: 'Solo Master puede agregar aseguradoras' }, { status: 403 });
    }

    const body = await request.json();
    const { scope, policy_type, insurer_id } = body;

    if (!scope || !policy_type || !insurer_id) {
      return NextResponse.json({ error: 'scope, policy_type e insurer_id son requeridos' }, { status: 400 });
    }

    // Verificar que la aseguradora existe
    const { data: insurer, error: insurerError } = await supabase
      .from('insurers')
      .select('id, name')
      .eq('id', insurer_id)
      .single();

    if (insurerError || !insurer) {
      return NextResponse.json({ error: 'Aseguradora no encontrada' }, { status: 404 });
    }

    // Verificar si ya existe al menos una sección para esta combinación
    const { data: existing } = await supabase
      .from('download_sections')
      .select('id')
      .eq('scope', scope)
      .eq('policy_type', policy_type)
      .eq('insurer_id', insurer_id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ 
        error: 'Esta aseguradora ya está agregada a este tipo de póliza' 
      }, { status: 400 });
    }

    // Crear sección por defecto "Documentos"
    const { data: section, error: sectionError } = await supabase
      .from('download_sections')
      .insert([{
        scope,
        policy_type,
        insurer_id,
        name: 'Documentos',
        display_order: 1
      }])
      .select()
      .single();

    if (sectionError) throw sectionError;

    return NextResponse.json({ 
      success: true, 
      message: `${insurer.name} agregada correctamente`,
      section
    });
  } catch (error) {
    console.error('Error adding insurer:', error);
    return NextResponse.json({ error: 'Error al agregar aseguradora' }, { status: 500 });
  }
}

// DELETE - Eliminar aseguradora de un tipo de póliza
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
      return NextResponse.json({ error: 'Solo Master puede eliminar aseguradoras' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const policyType = searchParams.get('policy_type');
    const insurerId = searchParams.get('insurer_id');

    if (!scope || !policyType || !insurerId) {
      return NextResponse.json({ 
        error: 'scope, policy_type e insurer_id son requeridos' 
      }, { status: 400 });
    }

    // Verificar si tiene archivos
    const { data: sectionsWithFiles } = await supabase
      .from('download_sections')
      .select(`
        id,
        download_files (id)
      `)
      .eq('scope', scope)
      .eq('policy_type', policyType)
      .eq('insurer_id', insurerId);

    const totalFiles = sectionsWithFiles?.reduce((acc, section: any) => 
      acc + (section.download_files?.length || 0), 0
    ) || 0;

    if (totalFiles > 0) {
      return NextResponse.json({ 
        error: `No se puede eliminar. La aseguradora tiene ${totalFiles} archivo(s). Elimínalos primero.` 
      }, { status: 400 });
    }

    // Eliminar todas las secciones de esta aseguradora en este tipo de póliza
    const { error } = await supabase
      .from('download_sections')
      .delete()
      .eq('scope', scope)
      .eq('policy_type', policyType)
      .eq('insurer_id', insurerId);

    if (error) throw error;

    return NextResponse.json({ 
      success: true,
      message: 'Aseguradora eliminada correctamente'
    });
  } catch (error) {
    console.error('Error deleting insurer:', error);
    return NextResponse.json({ error: 'Error al eliminar aseguradora' }, { status: 500 });
  }
}
