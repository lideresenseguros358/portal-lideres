import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Obtener pasos del workflow
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ramo = searchParams.get('ramo');
    const managementType = searchParams.get('management_type');

    let query = supabase
      .from('workflow_steps')
      .select('*')
      .order('display_order');

    if (ramo) query = query.eq('ramo', ramo);
    if (managementType) query = query.eq('management_type', managementType);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, steps: data });
  } catch (error: any) {
    console.error('Error fetching workflow steps:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear nuevo paso
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
      return NextResponse.json({ error: 'Solo Master puede configurar pasos' }, { status: 403 });
    }

    const body = await request.json();
    const { ramo, management_type, step_number, step_name, step_description, estimated_days, display_order } = body;

    if (!ramo || !management_type || !step_number || !step_name) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('workflow_steps')
      .insert([{
        ramo,
        management_type,
        step_number,
        step_name,
        step_description: step_description || null,
        estimated_days: estimated_days || 1,
        display_order: display_order ?? 999,
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, step: data });
  } catch (error: any) {
    console.error('Error creating workflow step:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar paso
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
      return NextResponse.json({ error: 'Solo Master puede configurar pasos' }, { status: 403 });
    }

    const body = await request.json();
    const { id, step_name, step_description, estimated_days, display_order } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const updates: any = {};
    if (step_name !== undefined) updates.step_name = step_name;
    if (step_description !== undefined) updates.step_description = step_description;
    if (estimated_days !== undefined) updates.estimated_days = estimated_days;
    if (display_order !== undefined) updates.display_order = display_order;

    const { data, error } = await supabase
      .from('workflow_steps')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, step: data });
  } catch (error: any) {
    console.error('Error updating workflow step:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar paso
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
      return NextResponse.json({ error: 'Solo Master puede configurar pasos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const { error } = await supabase
      .from('workflow_steps')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting workflow step:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
