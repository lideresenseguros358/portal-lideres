/**
 * API ENDPOINT: Renewal Response Handler
 * Maneja las respuestas de clientes a solicitudes de renovación
 * - Recibe clicks de botones SI/NO desde emails
 * - Envía notificación a tramites@lideresenseguros.com
 * - Crea caso automático en sistema de pendientes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail as sendEmailTramites } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const response = searchParams.get('response'); // 'yes' or 'no'
    const clientId = searchParams.get('clientId');
    const policyId = searchParams.get('policyId');

    // Validar parámetros
    if (!response || !clientId || !policyId) {
      return NextResponse.json(
        { error: 'Parámetros faltantes' },
        { status: 400 }
      );
    }

    if (!['yes', 'no'].includes(response)) {
      return NextResponse.json(
        { error: 'Respuesta inválida' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Obtener datos del cliente y póliza
    const { data: policy, error: policyError } = await supabase
      .from('policies')
      .select(`
        *,
        clients!inner(id, name, email, phone, national_id),
        insurers(name),
        brokers!broker_id(id, name, email, phone, p_id)
      `)
      .eq('id', policyId)
      .eq('client_id', clientId)
      .single();

    if (policyError || !policy) {
      console.error('Error obteniendo póliza:', policyError);
      return NextResponse.json(
        { error: 'Póliza no encontrada' },
        { status: 404 }
      );
    }

    const client = policy.clients;
    const insurer = policy.insurers;
    const broker = policy.brokers;

    // Determinar tipo de caso según respuesta
    const caseType = response === 'yes' ? 'Renovación Confirmada' : 'Renovación Rechazada';
    const priority = response === 'yes' ? 'media' : 'alta';
    const clientResponse = response === 'yes' 
      ? 'El cliente DESEA renovar su póliza' 
      : 'El cliente NO DESEA renovar su póliza';

    // Crear caso en sistema de pendientes
    const { data: newCase, error: caseError } = await supabase
      .from('cases')
      .insert({
        client_name: client.name,
        client_id: client.id,
        policy_number: policy.policy_number,
        policy_id: policy.id,
        insurer_id: policy.insurer_id || null,
        ctype: 'OTRO', // case_type_enum
        status: 'PENDIENTE_REVISION', // case_status_enum
        notes: `${clientResponse}.\n\nRespuesta automática del cliente a solicitud de renovación.\n\nFecha de vencimiento: ${policy.renewal_date}\nRamo: ${policy.ramo || 'N/A'}`,
        broker_id: broker?.id,
        canal: 'EMAIL',
        section: 'RAMOS_GENERALES',
      })
      .select()
      .single();

    if (caseError) {
      console.error('Error creando caso:', caseError);
      // Continuar aunque falle la creación del caso
    }

    // Enviar email a tramites@lideresenseguros.com
    const emailHtml = renderEmailTemplate('renewalResponseNotification', {
      clientName: client.name,
      clientEmail: client.email || 'No registrado',
      clientPhone: client.phone || 'No registrado',
      clientId: client.national_id || 'No registrado',
      policyNumber: policy.policy_number,
      insurerName: insurer?.name || 'N/A',
      ramo: policy.ramo || 'N/A',
      renewalDate: policy.renewal_date || 'N/A',
      startDate: policy.start_date || 'N/A',
      clientResponse: clientResponse,
      responseType: response === 'yes' ? 'AFIRMATIVA' : 'NEGATIVA',
      brokerName: broker?.name || 'N/A',
      brokerEmail: broker?.email || 'N/A',
      brokerPhone: broker?.phone || 'N/A',
      caseTicket: newCase?.ticket || 'N/A',
      portalUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://portal.lideresenseguros.com',
    });

    const emailSubject = response === 'yes' 
      ? `✅ Cliente ACEPTA renovación - ${policy.policy_number}`
      : `❌ Cliente RECHAZA renovación - ${policy.policy_number}`;

    await sendEmailTramites({
      to: 'tramites@lideresenseguros.com',
      subject: emailSubject,
      html: emailHtml,
      fromType: 'TRAMITES',
    });

    // Página de confirmación para el cliente
    const confirmationHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Respuesta Registrada</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 500px;
          text-align: center;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          color: #010139;
          font-size: 28px;
          margin: 0 0 16px 0;
        }
        p {
          color: #6D6D6D;
          font-size: 16px;
          line-height: 1.6;
          margin: 16px 0;
        }
        .highlight {
          background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%);
          padding: 16px;
          border-radius: 8px;
          margin: 24px 0;
          border-left: 4px solid #8AAA19;
        }
        .policy-info {
          text-align: left;
          margin: 20px 0;
          padding: 16px;
          background: #f7f7f7;
          border-radius: 8px;
        }
        .policy-info p {
          margin: 8px 0;
          font-size: 14px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          font-size: 13px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">${response === 'yes' ? '✅' : '❌'}</div>
        <h1>¡Respuesta Registrada!</h1>
        <p>
          ${response === 'yes' 
            ? 'Gracias por confirmar su interés en renovar su póliza.' 
            : 'Hemos registrado que no desea renovar su póliza en este momento.'}
        </p>
        
        <div class="highlight">
          <p style="margin: 0; font-weight: 600; color: #010139;">
            ${response === 'yes' 
              ? '🎯 Su corredor se pondrá en contacto con usted pronto para gestionar la renovación.'
              : '📞 Si cambió de opinión o tiene dudas, puede contactar a su corredor directamente.'}
          </p>
        </div>

        <div class="policy-info">
          <p><strong>Póliza:</strong> ${policy.policy_number}</p>
          <p><strong>Aseguradora:</strong> ${insurer?.name || 'N/A'}</p>
          <p><strong>Ramo:</strong> ${policy.ramo || 'N/A'}</p>
          <p><strong>Vence:</strong> ${policy.renewal_date || 'N/A'}</p>
        </div>

        <div class="policy-info">
          <p style="margin: 0 0 8px 0;"><strong>Su Corredor:</strong></p>
          <p><strong>Nombre:</strong> ${broker?.name || 'N/A'}</p>
          ${broker?.email ? `<p><strong>Email:</strong> ${broker.email}</p>` : ''}
          ${broker?.phone ? `<p><strong>Teléfono:</strong> ${broker.phone}</p>` : ''}
        </div>

        <div style="background:#010139;padding:16px;border-radius:8px;text-align:center;margin-top:30px;">
          <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;line-height:1.5;">
            Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá | Licencia PJ750
          </p>
          <img src="https://portal.lideresenseguros.com/aseguradoras/logo-SSRP.png" alt="SSRP" width="90" style="display:inline-block;max-width:90px;opacity:0.85;" />
        </div>
        <div class="footer" style="margin-top:12px;">
          <p>Líderes en Seguros</p>
        </div>
      </div>
    </body>
    </html>
    `;

    return new NextResponse(confirmationHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Error procesando respuesta de renovación:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
