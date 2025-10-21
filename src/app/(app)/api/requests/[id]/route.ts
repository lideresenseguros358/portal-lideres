import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// PATCH - Aprobar o rechazar solicitud
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServer();
    const { id } = await params;

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
      return NextResponse.json({ error: 'Solo Master puede aprobar/rechazar solicitudes' }, { status: 403 });
    }

    const body = await request.json();
    const { action, role, commission_percent } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    }

    // Obtener solicitud
    const { data: userRequest, error: requestError } = await supabase
      .from('user_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (requestError || !userRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    if (userRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Esta solicitud ya fue procesada' }, { status: 400 });
    }

    if (action === 'reject') {
      // Rechazar solicitud
      const { error: updateError } = await supabase
        .from('user_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      return NextResponse.json({ 
        success: true, 
        message: 'Solicitud rechazada' 
      });
    }

    // APROBAR
    if (!role || !['master', 'broker'].includes(role.toLowerCase())) {
      return NextResponse.json({ error: 'Rol inválido (debe ser master o broker)' }, { status: 400 });
    }

    if (commission_percent === undefined || commission_percent === null) {
      return NextResponse.json({ error: 'Porcentaje de comisión es requerido' }, { status: 400 });
    }

    // Validar porcentajes permitidos
    const allowedPercents = [0.50, 0.60, 0.70, 0.80, 0.82, 0.94, 1.00];
    if (!allowedPercents.includes(parseFloat(commission_percent))) {
      return NextResponse.json({ 
        error: 'Porcentaje de comisión inválido',
        allowed: allowedPercents
      }, { status: 400 });
    }

    // Desencriptar contraseña
    const password = Buffer.from(userRequest.encrypted_password, 'base64').toString();

    // Crear usuario en auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userRequest.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: userRequest.nombre_completo,
        role: role.toLowerCase()
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json({ 
        error: `Error al crear usuario: ${authError.message}` 
      }, { status: 500 });
    }

    // El trigger automáticamente creará el profile
    // Esperar un momento para que el trigger se ejecute
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Actualizar profile con datos adicionales
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: userRequest.nombre_completo,
        role: role.toLowerCase() as any
      })
      .eq('id', authData.user!.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Crear registro en brokers
    // Convertir additional_fields de Json a objeto
    const additionalFields = userRequest.additional_fields && typeof userRequest.additional_fields === 'object' 
      ? userRequest.additional_fields as Record<string, any>
      : {};

    // Obtener bank_route desde additional_fields si existe
    const bankRoute = additionalFields.bank_route || null;
    
    // Crear broker con campos ACH correctos
    const { error: brokerError } = await supabase
      .from('brokers')
      .insert([{
        id: authData.user!.id,
        p_id: authData.user!.id,
        // Datos personales
        nombre_completo: userRequest.nombre_completo, // Nombre del titular de cuenta
        national_id: userRequest.cedula, // Cédula del broker
        phone: userRequest.telefono,
        license_no: userRequest.licencia,
        birth_date: userRequest.fecha_nacimiento,
        // Datos bancarios ACH (campos correctos según brokers table)
        bank_route: bankRoute, // Código de ruta bancaria desde additional_fields
        bank_account_no: userRequest.numero_cuenta, // Número de cuenta
        tipo_cuenta: userRequest.tipo_cuenta || '04', // Tipo de cuenta: 03 o 04
        // Comisión
        percent_default: parseFloat(commission_percent),
        // Campos adicionales
        active: true,
        broker_type: additionalFields.broker_type || 'corredor',
        assa_code: additionalFields.assa_code || null,
        carnet_expiry_date: additionalFields.carnet_expiry_date || null
      }]);

    if (brokerError) {
      console.error('Error creating broker:', brokerError);
      return NextResponse.json({ 
        error: `Error al crear broker: ${brokerError.message}` 
      }, { status: 500 });
    }

    // Actualizar solicitud
    const { error: updateError } = await supabase
      .from('user_requests')
      .update({
        status: 'approved',
        assigned_role: role.toLowerCase(),
        assigned_commission_percent: parseFloat(commission_percent),
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating request:', updateError);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Solicitud aprobada y usuario creado',
      user_id: authData.user!.id
    });

  } catch (error: any) {
    console.error('Error processing request:', error);
    return NextResponse.json({ 
      error: error.message || 'Error al procesar solicitud' 
    }, { status: 500 });
  }
}
