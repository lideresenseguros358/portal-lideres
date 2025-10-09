import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { TablesUpdate } from '@/lib/supabase/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id } = params;

    // Validar datos requeridos
    if (!body.policy_number || body.policy_number.trim() === '') {
      return NextResponse.json(
        { error: 'El número de póliza es requerido' },
        { status: 400 }
      );
    }

    if (!body.insurer_id) {
      return NextResponse.json(
        { error: 'La aseguradora es requerida' },
        { status: 400 }
      );
    }

    // Preparar payload de actualización
    const updatePayload: TablesUpdate<'policies'> = {
      policy_number: body.policy_number.trim().toUpperCase(),
      ramo: body.ramo?.trim().toUpperCase() || null,
      insurer_id: body.insurer_id,
      start_date: body.start_date || null,
      renewal_date: body.renewal_date || null,
      status: body.status || 'ACTIVA',
      percent_override: body.percent_override !== null && body.percent_override !== undefined
        ? Number(body.percent_override)
        : null,
    };

    // Actualizar póliza
    const { data, error } = await supabase
      .from('policies')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error actualizando póliza:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error en PUT /api/db/policies/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Eliminar póliza
    const { error } = await supabase
      .from('policies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando póliza:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error en DELETE /api/db/policies/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error del servidor' },
      { status: 500 }
    );
  }
}
