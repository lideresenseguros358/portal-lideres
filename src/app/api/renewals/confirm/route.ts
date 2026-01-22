/**
 * ENDPOINT: CONFIRMACIÓN DE RENOVACIÓN
 * ====================================
 * Se llama desde el botón CTA del correo de renovación
 * Crea automáticamente un caso en Pendientes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const policyId = searchParams.get('policyId');
  const masterToken = searchParams.get('masterToken');

  if (!policyId || !masterToken) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Obtener póliza con datos relacionados
    const { data: policy, error: policyError } = await supabase
      .from('policies')
      .select(`
        id,
        policy_number,
        renewal_date,
        premium,
        ramo,
        client_id,
        broker_id,
        insurer_id,
        clients!inner(name, email),
        brokers!inner(name, email)
      `)
      .eq('id', policyId)
      .single();

    if (policyError || !policy) {
      console.error('[RENEWALS] Error fetching policy:', policyError);
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    const client = policy.clients as any;
    const broker = policy.brokers as any;

    // Crear caso en Pendientes
    const { data: newCase, error: caseError } = await supabase
      .from('cases')
      .insert({
        ctype: 'EMISION_GENERAL',
        client_id: policy.client_id,
        client_name: client.name,
        broker_id: policy.broker_id,
        assigned_master_id: masterToken,
        policy_id: policyId,
        policy_number: policy.policy_number,
        ramo_code: policy.ramo,
        aseguradora_code: policy.insurer_id,
        premium: policy.premium,
        estado_simple: 'Nuevo',
        notes: `Renovación iniciada desde correo automático. Póliza vencida: ${policy.policy_number}`,
        canal: 'CORREO',
        section: 'RAMOS_GENERALES',
        status: 'PENDIENTE_REVISION',
      })
      .select()
      .single();

    if (caseError || !newCase) {
      console.error('[RENEWALS] Error creating case:', caseError);
      return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
    }

    // Notificar creación del caso
    try {
      const { notifyCaseCreated } = await import('@/lib/email/pendientes');
      await notifyCaseCreated(newCase.id);
    } catch (emailError) {
      console.error('[RENEWALS] Error sending email notification:', emailError);
    }

    // Redirigir al portal con highlight del caso
    const redirectUrl = `${appUrl}/pendientes?highlight=${newCase.id}`;
    return NextResponse.redirect(redirectUrl);

  } catch (error: any) {
    console.error('[RENEWALS] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
