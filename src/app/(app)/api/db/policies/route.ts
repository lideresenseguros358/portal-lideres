import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { TablesInsert } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
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

    // Validar datos requeridos
    if (!body.client_id) {
      return NextResponse.json(
        { error: 'El cliente es requerido' },
        { status: 400 }
      );
    }

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

    // Preparar payload de inserción
    const insertPayload: TablesInsert<'policies'> = {
      client_id: body.client_id,
      policy_number: body.policy_number.trim().toUpperCase(),
      ramo: body.ramo?.trim().toUpperCase() || null,
      insurer_id: body.insurer_id,
      broker_id: body.broker_id || null,
      start_date: body.start_date || null,
      renewal_date: body.renewal_date || null,
      status: body.status || 'ACTIVA',
      percent_override: body.percent_override !== null && body.percent_override !== undefined
        ? Number(body.percent_override)
        : null,
      notas: body.notas?.trim().toUpperCase() || null,
    };

    // Si no se proporciona broker_id, buscar el broker del cliente
    if (!insertPayload.broker_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('id', body.client_id)
        .single();

      if (clientData) {
        // Buscar pólizas existentes del cliente para obtener el broker
        const { data: existingPolicies } = await supabase
          .from('policies')
          .select('broker_id')
          .eq('client_id', body.client_id)
          .not('broker_id', 'is', null)
          .limit(1);

        if (existingPolicies && existingPolicies.length > 0 && existingPolicies[0]) {
          insertPayload.broker_id = existingPolicies[0].broker_id;
        }
      }
    }

    // Crear póliza
    const { data, error } = await supabase
      .from('policies')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      console.error('Error creando póliza:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error en POST /api/db/policies:', error);
    return NextResponse.json(
      { error: error.message || 'Error del servidor' },
      { status: 500 }
    );
  }
}
