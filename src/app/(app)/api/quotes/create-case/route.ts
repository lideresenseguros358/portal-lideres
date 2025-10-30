import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { TablesInsert } from '@/lib/database.types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formData, insurerId, insurerName, planType, annualPremium } = body;

    const supabase = await getSupabaseServer();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    // Get insurer ID from database by name
    const { data: insurerData, error: insurerError } = await supabase
      .from('insurers')
      .select('id')
      .ilike('name', `%${insurerName}%`)
      .single();

    if (insurerError) {
      console.error('Error finding insurer:', insurerError);
      return NextResponse.json({ ok: false, error: 'Aseguradora no encontrada' }, { status: 404 });
    }

    // Create case
    const casePayload: TablesInsert<'cases'> = {
      section: 'RAMOS_GENERALES',
      status: 'PENDIENTE_REVISION',
      management_type: 'EMISION_AUTO',
      client_name: `${formData.firstName} ${formData.lastName}`,
      insurer_id: insurerData.id,
      policy_number: null,
      premium: annualPremium,
      payment_method: planType === 'premium' ? 'CUOTAS' : 'ANUAL',
      notes: `Cotización desde portal web - Daños a Terceros
Plan: ${planType === 'basic' ? 'Básico' : 'Premium'}
Aseguradora: ${insurerName}

DATOS DEL CLIENTE:
Nombre: ${formData.firstName} ${formData.lastName}
Cédula: ${formData.nationalId}
Email: ${formData.email}
Dirección: ${formData.address}

DATOS DEL VEHÍCULO:
Placa: ${formData.plateNumber}
Marca/Modelo: ${formData.brand} ${formData.model}
Año: ${formData.year}

DATOS JSON COMPLETOS:
${JSON.stringify(formData, null, 2)}`,
      created_by: user.id,
    };

    const { data: newCase, error: caseError } = await supabase
      .from('cases')
      .insert([casePayload] satisfies TablesInsert<'cases'>[])
      .select()
      .single();

    if (caseError) {
      console.error('Error creating case:', caseError);
      return NextResponse.json({ ok: false, error: 'Error al crear el caso' }, { status: 500 });
    }

    // TODO: Send notification email to broker
    // TODO: Create notification in app

    return NextResponse.json({
      ok: true,
      caseId: newCase.id,
      message: 'Caso creado exitosamente',
    });

  } catch (error) {
    console.error('Error in create-case API:', error);
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
