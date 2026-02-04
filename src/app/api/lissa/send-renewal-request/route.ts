/**
 * API ENDPOINT: LISSA Send Renewal Request
 * Envía email de renovación AL CLIENTE desde sección LISSA
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';

export async function POST(request: NextRequest) {
  try {
    const { policy_id, client_id } = await request.json();

    if (!policy_id || !client_id) {
      return NextResponse.json(
        { error: 'Parámetros faltantes' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Obtener datos completos
    const { data: policy, error: policyError } = await supabase
      .from('policies')
      .select(`
        *,
        clients!inner(id, name, email, phone, national_id),
        insurers(name),
        brokers(id, name, email, phone)
      `)
      .eq('id', policy_id)
      .eq('client_id', client_id)
      .single();

    if (policyError || !policy) {
      return NextResponse.json({ error: 'Póliza no encontrada' }, { status: 404 });
    }

    const client = policy.clients;
    const insurer = policy.insurers;
    const broker = policy.brokers || {
      name: 'LISSA Oficina',
      email: 'contacto@lideresenseguros.com',
      phone: '6000-0000'
    };

    if (!client.email) {
      return NextResponse.json({ error: 'Cliente sin email' }, { status: 400 });
    }

    // Calcular días hasta renovación
    const today = new Date();
    const renewalDate = policy.renewal_date ? new Date(policy.renewal_date) : new Date();
    const diffTime = renewalDate.getTime() - today.getTime();
    const daysUntilRenewal = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Generar URLs para botones SI/NO
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const yesUrl = `${baseUrl}/api/renewal-response?response=yes&clientId=${client_id}&policyId=${policy_id}`;
    const noUrl = `${baseUrl}/api/renewal-response?response=no&clientId=${client_id}&policyId=${policy_id}`;

    // Renderizar email
    const html = renderEmailTemplate('clientRenewalRequest', {
      clientName: client.name,
      policyNumber: policy.policy_number,
      insurerName: insurer?.name || 'N/A',
      ramo: policy.ramo || 'N/A',
      renewalDate: policy.renewal_date,
      startDate: policy.start_date,
      daysUntilRenewal: daysUntilRenewal,
      brokerName: broker.name,
      brokerEmail: broker.email,
      brokerPhone: broker.phone,
      yesUrl: yesUrl,
      noUrl: noUrl,
      portalUrl: baseUrl,
    });

    // Enviar email al cliente
    await sendEmail({
      to: client.email,
      subject: `🔄 Renovación de su Póliza ${policy.policy_number}`,
      html,
      fromType: 'PORTAL',
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Email de renovación enviado exitosamente' 
    });

  } catch (error) {
    console.error('Error enviando email de renovación:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
