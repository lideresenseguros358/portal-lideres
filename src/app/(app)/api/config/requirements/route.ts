import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Obtener todos los requisitos
export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data, error } = await (supabase as any)
      .from('policy_requirements')
      .select('*')
      .order('ramo')
      .order('display_order');

    if (error) throw error;

    return NextResponse.json({ success: true, requirements: data });
  } catch (error: any) {
    console.error('Error fetching requirements:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear nuevo requisito
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
      return NextResponse.json({ error: 'Solo Master puede configurar requisitos' }, { status: 403 });
    }

    const body = await request.json();
    const { ramo, label, required, standard_name, requirement_type, linked_download_section, linked_download_file, display_order } = body;

    if (!ramo || !label || !standard_name) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const { data, error } = await (supabase as any)
      .from('policy_requirements')
      .insert([{
        ramo,
        label,
        required: required ?? true,
        standard_name,
        requirement_type: requirement_type || 'DOCUMENTO',
        linked_download_section: linked_download_section || null,
        linked_download_file: linked_download_file || null,
        display_order: display_order ?? 999,
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, requirement: data });
  } catch (error: any) {
    console.error('Error creating requirement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar requisito
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
      return NextResponse.json({ error: 'Solo Master puede configurar requisitos' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ramo, label, required, standard_name, requirement_type, linked_download_section, linked_download_file } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const updates: any = {};
    if (ramo !== undefined) updates.ramo = ramo;
    if (label !== undefined) updates.label = label;
    if (required !== undefined) updates.required = required;
    if (standard_name !== undefined) updates.standard_name = standard_name;
    if (requirement_type !== undefined) updates.requirement_type = requirement_type;
    if (linked_download_section !== undefined) updates.linked_download_section = linked_download_section || null;
    if (linked_download_file !== undefined) updates.linked_download_file = linked_download_file || null;

    const { data, error } = await (supabase as any)
      .from('policy_requirements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, requirement: data });
  } catch (error: any) {
    console.error('Error updating requirement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar requisito
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
      return NextResponse.json({ error: 'Solo Master puede configurar requisitos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from('policy_requirements')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting requirement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
