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

    // Si no se proporciona broker_id, resolver desde el usuario autenticado
    if (!insertPayload.broker_id) {
      // 1. Intentar obtener broker_id del perfil del usuario
      const { data: profile } = await supabase
        .from('profiles')
        .select('broker_id, role')
        .eq('id', user.id)
        .single();

      if (profile?.broker_id) {
        insertPayload.broker_id = profile.broker_id;
      } else {
        // 2. Buscar en la tabla brokers por p_id (auth user id)
        const { data: broker } = await supabase
          .from('brokers')
          .select('id')
          .eq('p_id', user.id)
          .single();

        if (broker?.id) {
          insertPayload.broker_id = broker.id;
        } else {
          // 3. Fallback: buscar broker desde pólizas existentes del cliente
          const { data: existingPolicies } = await supabase
            .from('policies')
            .select('broker_id')
            .eq('client_id', body.client_id)
            .not('broker_id', 'is', null)
            .limit(1);

          if (existingPolicies && existingPolicies.length > 0 && existingPolicies[0]) {
            insertPayload.broker_id = existingPolicies[0].broker_id;
          } else if (profile?.role === 'master') {
            // 4. Si es master y el cliente tiene broker_id, usar ese
            const { data: clientData } = await supabase
              .from('clients')
              .select('broker_id')
              .eq('id', body.client_id)
              .single();

            if (clientData?.broker_id) {
              insertPayload.broker_id = clientData.broker_id;
            }
          }
        }
      }
    }

    // Validar que broker_id no sea null antes de insertar
    if (!insertPayload.broker_id) {
      return NextResponse.json(
        { error: 'No se pudo determinar el corredor para esta póliza. Por favor selecciona un corredor.' },
        { status: 400 }
      );
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
