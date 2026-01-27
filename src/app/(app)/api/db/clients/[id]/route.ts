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

    // Determinar rol del usuario (para permitir cambios de broker solo a Master)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Validar datos
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre del cliente es requerido' },
        { status: 400 }
      );
    }

    // Obtener datos actuales del cliente
    const { data: currentClient, error: fetchError } = await supabase
      .from('clients')
      .select('national_id, name')
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    const newNationalId = body.national_id?.trim().toUpperCase() || null;
    
    // DETECCIÓN DE DUPLICADOS: Si se está agregando/cambiando la cédula
    if (newNationalId && newNationalId !== currentClient.national_id) {
      // Buscar si ya existe otro cliente con esta cédula
      const { data: duplicate, error: dupError } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          national_id,
          email,
          phone,
          birth_date,
          active,
          broker_id,
          policies (
            id,
            policy_number,
            insurer_id,
            ramo,
            status,
            insurers (name)
          )
        `)
        .eq('national_id', newNationalId)
        .neq('id', id)
        .single();

      // Si existe un duplicado, retornar info para que el frontend pregunte
      if (duplicate && !dupError) {
        return NextResponse.json({
          duplicate_found: true,
          duplicate: duplicate,
          current_client_id: id,
          current_client_name: currentClient.name,
        });
      }
    }

    // Preparar payload de actualización
    const updatePayload: TablesUpdate<'clients'> = {
      name: body.name.trim().toUpperCase(),
      national_id: newNationalId,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      // birth_date: mantener como string YYYY-MM-DD sin conversión de zona horaria
      birth_date: body.birth_date?.trim() || null,
      active: body.active ?? true,
    };

    // CRÍTICO: Solo actualizar broker_id si viene explícitamente y el usuario es Master
    // Esto evita que un update normal (o con datos antiguos) revierta el broker asignado.
    if (Object.prototype.hasOwnProperty.call(body, 'broker_id')) {
      if (profile?.role !== 'master') {
        return NextResponse.json(
          { error: 'Solo Master puede cambiar el corredor asignado' },
          { status: 403 }
        );
      }
      (updatePayload as any).broker_id = body.broker_id || null;
    }

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
