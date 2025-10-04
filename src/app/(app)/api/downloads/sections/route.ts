import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Obtener secciones de descargas
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
    const insurerId = searchParams.get('insurer_id');

    let query = supabase
      .from('download_sections')
      .select(`
        *,
        download_files (id, is_new, marked_new_until)
      `)
      .order('display_order');

    if (scope) query = query.eq('scope', scope);
    if (policyType) query = query.eq('policy_type', policyType);
    if (insurerId) query = query.eq('insurer_id', insurerId);

    const { data: sections, error } = await query;

    if (error) throw error;

    // Procesar counts
    const now = new Date();
    const sectionsWithCounts = sections?.map(section => {
      const files = section.download_files || [];
      return {
        id: section.id,
        scope: section.scope,
        policy_type: section.policy_type,
        insurer_id: section.insurer_id,
        name: section.name,
        display_order: section.display_order,
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
    console.error('Error fetching download sections:', error);
    return NextResponse.json({ error: 'Error al obtener secciones' }, { status: 500 });
  }
}

// POST - Crear nueva sección
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
      return NextResponse.json({ error: 'Solo Master puede crear secciones' }, { status: 403 });
    }

    const body = await request.json();
    const { scope, policy_type, insurer_id, name } = body;

    if (!scope || !policy_type || !name) {
      return NextResponse.json({ error: 'scope, policy_type y name son requeridos' }, { status: 400 });
    }

    // Validar scope
    if (scope !== 'generales' && scope !== 'personas') {
      return NextResponse.json({ error: 'scope debe ser "generales" o "personas"' }, { status: 400 });
    }

    // Obtener último orden
    let orderQuery = supabase
      .from('download_sections')
      .select('display_order')
      .eq('scope', scope)
      .eq('policy_type', policy_type)
      .order('display_order', { ascending: false })
      .limit(1);

    if (insurer_id) {
      orderQuery = orderQuery.eq('insurer_id', insurer_id);
    }

    const { data: lastSection } = await orderQuery.single();
    const newOrder = (lastSection?.display_order || 0) + 1;

    // Crear sección
    const { data: section, error } = await supabase
      .from('download_sections')
      .insert([{
        scope,
        policy_type,
        insurer_id,
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
    console.error('Error creating download section:', error);
    return NextResponse.json({ error: 'Error al crear sección' }, { status: 500 });
  }
}

// PUT y DELETE similares a guides/sections
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
      .from('download_sections')
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
    console.error('Error updating download section:', error);
    return NextResponse.json({ error: 'Error al actualizar sección' }, { status: 500 });
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
      return NextResponse.json({ error: 'Solo Master puede eliminar secciones' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // Verificar si tiene archivos
    const { data: files } = await supabase
      .from('download_files')
      .select('id')
      .eq('section_id', id);

    if (files && files.length > 0) {
      return NextResponse.json({ 
        error: `No se puede eliminar. La sección tiene ${files.length} archivo(s)` 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('download_sections')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting download section:', error);
    return NextResponse.json({ error: 'Error al eliminar sección' }, { status: 500 });
  }
}
