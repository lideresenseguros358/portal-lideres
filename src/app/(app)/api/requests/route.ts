import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

// GET - Listar solicitudes
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: 'Solo Master puede ver solicitudes' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const { data: requests, error } = await supabase
      .from('user_requests')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, requests });

  } catch (error: any) {
    console.error('Error fetching requests:', error);
    return NextResponse.json({ error: 'Error al obtener solicitudes' }, { status: 500 });
  }
}

// POST - Crear nueva solicitud (desde formulario público)
// IMPORTANTE: Usa cliente público (anónimo) para permitir inserciones sin autenticación
export async function POST(request: NextRequest) {
  try {
    // Crear cliente Supabase 100% anónimo (sin cookies, sin sesión, sin auth)
    // Esto permite inserciones anónimas gracias a la política RLS "public_can_insert_request"
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            // Forzar que NO use ningún token de autenticación
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          }
        }
      }
    );
    
    const body = await request.json();

    const {
      credentials,
      personalData,
      bankData,
      additionalFields = {}
    } = body;

    // Validaciones
    if (!credentials?.email || !credentials?.password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    if (!personalData?.cedula || !personalData?.fecha_nacimiento || !personalData?.telefono) {
      return NextResponse.json({ error: 'Datos personales incompletos' }, { status: 400 });
    }

    // Validaciones ACH
    if (!bankData?.bank_route) {
      return NextResponse.json({ error: 'Debe seleccionar un banco' }, { status: 400 });
    }
    if (!bankData?.account_type) {
      return NextResponse.json({ error: 'Debe seleccionar el tipo de cuenta' }, { status: 400 });
    }
    if (!bankData?.account_number) {
      return NextResponse.json({ error: 'Número de cuenta es requerido' }, { status: 400 });
    }
    if (!bankData?.nombre_completo) {
      return NextResponse.json({ error: 'Nombre completo del titular es requerido' }, { status: 400 });
    }

    // NOTA: No podemos verificar emails duplicados con cliente anónimo porque
    // la política RLS solo permite SELECT a usuarios master.
    // La base de datos manejará duplicados con unique constraint si es necesario.

    // Encriptar contraseña (en producción usar bcrypt, aquí simplificado)
    const encryptedPassword = Buffer.from(credentials.password).toString('base64');

    // ============================================
    // INSERCIÓN PÚBLICA SIN AUTENTICACIÓN
    // ============================================
    // Gracias a la política RLS "public_can_insert_request" (TO anon, authenticated WITH CHECK true)
    // este INSERT funciona sin requerir usuario autenticado.
    // La seguridad se maneja mediante:
    //   1. Solo INSERT está permitido (no SELECT)
    //   2. Master debe aprobar/rechazar (políticas separadas)
    //   3. Validaciones en backend
    // ============================================
    const { error } = await supabase
      .from('user_requests')
      .insert([{
        email: credentials.email,
        encrypted_password: encryptedPassword,
        cedula: personalData.cedula,
        fecha_nacimiento: personalData.fecha_nacimiento,
        telefono: personalData.telefono,
        licencia: personalData.licencia || null,
        nombre_completo: personalData.nombre || bankData.nombre_completo, // Nombre del solicitante
        // Campos ACH (estructura actualizada después de migración)
        bank_route: bankData.bank_route, // Código de ruta bancaria
        bank_account_no: bankData.account_number, // Número de cuenta (limpio)
        tipo_cuenta: bankData.account_type, // Código tipo: "03" o "04"
        nombre_completo_titular: bankData.nombre_completo, // Titular (MAYÚS sin acentos)
        additional_fields: {
          ...additionalFields,
          broker_type: personalData.broker_type || 'corredor',
          assa_code: personalData.assa_code || '',
          carnet_expiry_date: personalData.carnet_expiry_date || null
        },
        status: 'pending'
      }]);
      // NO hacemos .select() porque el usuario anónimo no tiene permisos de SELECT
      // La política RLS "master_can_view_requests" solo permite SELECT a usuarios master

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: 'Solicitud enviada exitosamente. Espera la aprobación del Master.'
    });

  } catch (error: any) {
    console.error('Error creating request:', error);
    return NextResponse.json({ 
      error: error.message || 'Error al crear solicitud' 
    }, { status: 500 });
  }
}
