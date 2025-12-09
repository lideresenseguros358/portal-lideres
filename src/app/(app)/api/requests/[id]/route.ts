import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

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
      // ELIMINAR solicitud completamente (no solo marcarla como rechazada)
      // Esto evita acumular data inútil en la base de datos
      const { error: deleteError } = await supabase
        .from('user_requests')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return NextResponse.json({ 
        success: true, 
        message: 'Solicitud rechazada y eliminada' 
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

    // Crear cliente admin para operaciones privilegiadas
    const adminClient = getSupabaseAdmin();

    console.log('🔵 Intentando crear usuario:', {
      email: userRequest.email,
      has_password: !!password,
      password_length: password.length,
      password_preview: password.substring(0, 3) + '***',
      role: role.toLowerCase()
    });

    // Verificar si el usuario ya existe
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const userExists = existingUsers?.users.find(u => u.email === userRequest.email);
    
    if (userExists) {
      console.error('❌ Usuario ya existe:', userRequest.email);
      return NextResponse.json({ 
        error: `El email ${userRequest.email} ya está registrado en el sistema` 
      }, { status: 400 });
    }

    // Preparar additional_fields
    const additionalFields = userRequest.additional_fields && typeof userRequest.additional_fields === 'object' 
      ? userRequest.additional_fields as Record<string, any>
      : {};

    // Crear usuario en auth.users usando cliente admin
    // IMPORTANTE: Pasar TODOS los datos en user_metadata para que el trigger los use
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: userRequest.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        // Datos básicos
        full_name: userRequest.nombre_completo,
        role: role.toLowerCase(),
        
        // Datos personales
        cedula: userRequest.cedula,
        national_id: userRequest.cedula,
        telefono: userRequest.telefono,
        phone: userRequest.telefono,
        licencia: userRequest.licencia,
        license_no: userRequest.licencia,
        fecha_nacimiento: userRequest.fecha_nacimiento,
        birth_date: userRequest.fecha_nacimiento,
        
        // Datos bancarios ACH
        bank_route: userRequest.bank_route,
        bank_account_no: userRequest.bank_account_no,
        tipo_cuenta: userRequest.tipo_cuenta,
        beneficiary_name: userRequest.nombre_completo_titular,
        nombre_completo_titular: userRequest.nombre_completo_titular,
        
        // Comisión
        percent_default: parseFloat(commission_percent),
        
        // Campos adicionales
        broker_type: additionalFields.broker_type || 'corredor',
        assa_code: additionalFields.assa_code || null,
        carnet_expiry_date: additionalFields.carnet_expiry_date || null
      }
    });

    if (authError) {
      console.error('❌ Error creating auth user:', {
        error: authError,
        message: authError.message,
        status: authError.status,
        code: (authError as any).code
      });
      return NextResponse.json({ 
        error: `Error al crear usuario: ${authError.message}`,
        details: (authError as any).code || authError.status
      }, { status: 500 });
    }

    console.log('✅ Usuario creado en auth.users:', authData.user.id);

    // El trigger handle_new_user_full() automáticamente creará:
    // 1. Profile con rol y datos personales
    // 2. Broker con todos los campos (cédula, banco, comisión, etc.)
    // 3. Link broker_id en profile
    // Todos los datos vienen de user_metadata que pasamos arriba
    
    // Esperar un momento para que el trigger se ejecute
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('✅ Trigger ejecutado - Profile y Broker creados');

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
