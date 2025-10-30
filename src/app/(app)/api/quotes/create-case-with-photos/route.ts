import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { TablesInsert } from '@/lib/database.types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const formDataString = formData.get('formData') as string;
    const insurerName = formData.get('insurerName') as string;
    const planType = formData.get('planType') as string;
    const annualPremium = parseFloat(formData.get('annualPremium') as string);

    if (!formDataString || !insurerName) {
      return NextResponse.json({ ok: false, error: 'Datos incompletos' }, { status: 400 });
    }

    const clientData = JSON.parse(formDataString);

    const supabase = await getSupabaseServer();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    // Get insurer ID
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
      client_name: `${clientData.firstName} ${clientData.lastName}`,
      insurer_id: insurerData.id,
      policy_number: null,
      premium: annualPremium,
      payment_method: 'ANUAL',
      notes: `Cotización desde portal web - Cobertura Completa
Plan: ${planType}
Aseguradora: ${insurerName}

DATOS DEL CLIENTE:
Nombre: ${clientData.firstName} ${clientData.lastName}
Cédula: ${clientData.nationalId}
Email: ${clientData.email}
Dirección: ${clientData.address}

DATOS DEL VEHÍCULO:
Placa: ${clientData.plateNumber}
Marca/Modelo: ${clientData.brand} ${clientData.model}
Año: ${clientData.year}

FOTOS ADJUNTAS: 6 fotos de inspección del vehículo

DATOS JSON COMPLETOS:
${JSON.stringify(clientData, null, 2)}`,
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

    // Upload photos to storage
    const photoKeys = ['frontal', 'trasera', 'lateral_izquierda', 'lateral_derecha', 'tablero', 'serial_motor'];
    const uploadedPhotos: string[] = [];

    for (const key of photoKeys) {
      const photoFile = formData.get(`photo_${key}`) as File;
      if (photoFile) {
        const fileName = `${newCase.id}_${key}_${Date.now()}.${photoFile.name.split('.').pop()}`;
        const filePath = `pendientes/${newCase.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('pendientes')
          .upload(filePath, photoFile, {
            contentType: photoFile.type,
            upsert: false,
          });

        if (uploadError) {
          console.error(`Error uploading photo ${key}:`, uploadError);
          // Continue with other photos even if one fails
        } else {
          uploadedPhotos.push(fileName);
        }
      }
    }

    // TODO: Create case_files records for each photo (if table exists)
    // TODO: Send notification email to broker
    // TODO: Create notification in app

    return NextResponse.json({
      ok: true,
      caseId: newCase.id,
      photosUploaded: uploadedPhotos.length,
      message: 'Caso creado exitosamente con fotos',
    });

  } catch (error) {
    console.error('Error in create-case-with-photos API:', error);
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
