import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { TablesUpdate } from '@/lib/supabase/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params;

    // Validar datos
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre del cliente es requerido' },
        { status: 400 }
      );
    }

    // Preparar payload de actualización
    const updatePayload: TablesUpdate<'clients'> = {
      name: body.name.trim().toUpperCase(),
      national_id: body.national_id?.trim().toUpperCase() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      // birth_date: mantener como string YYYY-MM-DD sin conversión de zona horaria
      birth_date: body.birth_date?.trim() || null,
      active: body.active ?? true,
      broker_id: body.broker_id || null, // ← CRÍTICO: guardar cambio de broker
    };

    // Actualizar cliente
    const { data, error } = await supabase
      .from('clients')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error actualizando cliente:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error en PUT /api/db/clients/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    // Verificar si tiene pólizas
    const { data: policies } = await supabase
      .from('policies')
      .select('id')
      .eq('client_id', id)
      .limit(1);

    if (policies && policies.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un cliente con pólizas. Elimine las pólizas primero.' },
        { status: 400 }
      );
    }

    // Eliminar cliente
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando cliente:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error en DELETE /api/db/clients/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error del servidor' },
      { status: 500 }
    );
  }
}
