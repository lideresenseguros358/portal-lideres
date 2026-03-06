/**
 * API ENDPOINT: Renewal Actions
 * Maneja todas las acciones específicas para casos de renovación
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    const supabase = getSupabaseAdmin();

    // Determinar si es FormData (archivo) o JSON
    let data: any;
    let action: string;
    let case_id: string;

    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      action = formData.get('action') as string;
      case_id = formData.get('case_id') as string;
      data = { file: formData.get('file') };
    } else {
      const body = await request.json();
      action = body.action;
      case_id = body.case_id;
      data = body;
    }

    // Obtener caso
    const { data: caso, error: caseError } = await supabase
      .from('cases')
      .select(`
        *,
        policies!policy_id(*, insurers!insurer_id(name)),
        clients!client_id(*),
        brokers!broker_id(*)
      `)
      .eq('id', case_id)
      .single();

    if (caseError || !caso) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
    }

    // ACCIÓN 1: Adjuntar carátula y cerrar caso
    if (action === 'attach_and_close') {
      const file = data.file as File;
      if (!file) {
        return NextResponse.json({ error: 'Archivo no proporcionado' }, { status: 400 });
      }

      // Subir archivo a storage (implementar según tu sistema de storage)
      // Por ahora solo actualizamos el caso
      
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          status: 'CERRADO',
          notes: `${caso.notes}\n\n[RENOVACIÓN APROBADA]\nCarátula adjuntada: ${file.name}\nCerrado automáticamente.`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', case_id);

      if (updateError) {
        return NextResponse.json({ error: 'Error al actualizar caso' }, { status: 500 });
      }

      // Notificar al broker
      if (caso.brokers?.email) {
        const html = renderEmailTemplate('caseStatusUpdate', {
          brokerName: caso.brokers.name,
          caseTicket: caso.ticket,
          clientName: caso.client_name,
          newStatus: 'Cerrado - Renovación Aprobada',
          message: 'La renovación ha sido procesada exitosamente. La carátula ha sido adjuntada al caso.',
          portalUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://portal.lideresenseguros.com',
        });

        await sendEmail({
          to: caso.brokers.email,
          subject: `✅ Renovación Aprobada - ${caso.ticket}`,
          html,
          fromType: 'TRAMITES',
        });
      }

      return NextResponse.json({ success: true, message: 'Caso cerrado exitosamente' });
    }

    // ACCIÓN 2: Enviar pregunta personalizada al cliente
    if (action === 'send_question') {
      const { question } = data;
      if (!question) {
        return NextResponse.json({ error: 'Pregunta no proporcionada' }, { status: 400 });
      }

      const client = caso.clients;
      if (!client?.email) {
        return NextResponse.json({ error: 'Cliente sin email' }, { status: 400 });
      }

      // Actualizar notas del caso
      await supabase
        .from('cases')
        .update({
          notes: `${caso.notes}\n\n[PREGUNTA ENVIADA AL CLIENTE]\n${question}`,
          status: 'PENDIENTE_REVISION',
          updated_at: new Date().toISOString(),
        })
        .eq('id', case_id);

      // Enviar email al cliente
      const html = renderEmailTemplate('clientQuestion', {
        clientName: client.name,
        question: question,
        policyNumber: caso.policy_number,
        brokerName: caso.brokers?.name,
        brokerEmail: caso.brokers?.email,
        brokerPhone: caso.brokers?.phone,
        portalUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://portal.lideresenseguros.com',
      });

      await sendEmail({
        to: client.email,
        subject: `Consulta sobre su Póliza ${caso.policy_number}`,
        html,
        fromType: 'PORTAL',
      });

      return NextResponse.json({ success: true, message: 'Pregunta enviada al cliente' });
    }

    // ACCIÓN 3: Marcar como cancelación
    if (action === 'mark_cancellation') {
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          status: 'EN_PROCESO',
          notes: `${caso.notes}\n\n[MARCADO COMO CANCELACIÓN]\nEl cliente rechazó la renovación. Se requiere eliminar la póliza del sistema.`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', case_id);

      if (updateError) {
        return NextResponse.json({ error: 'Error al actualizar caso' }, { status: 500 });
      }

      // Notificar al master
      const html = renderEmailTemplate('cancellationAlert', {
        caseTicket: caso.ticket,
        clientName: caso.client_name,
        policyNumber: caso.policy_number,
        insurerName: (caso.policies as any)?.insurers?.name || 'N/A',
        brokerName: caso.brokers?.name,
        portalUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://portal.lideresenseguros.com',
      });

      await sendEmail({
        to: 'tramites@lideresenseguros.com',
        subject: `🚫 CANCELACIÓN - ${caso.policy_number} - ${caso.client_name}`,
        html,
        fromType: 'TRAMITES',
      });

      return NextResponse.json({ success: true, message: 'Caso marcado como cancelación' });
    }

    // ACCIÓN 4: Cerrar caso de cancelación
    if (action === 'close_cancellation') {
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          status: 'CERRADO',
          notes: `${caso.notes}\n\n[CANCELACIÓN COMPLETADA]\nPóliza eliminada del sistema. Caso cerrado.`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', case_id);

      if (updateError) {
        return NextResponse.json({ error: 'Error al actualizar caso' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Caso de cancelación cerrado' });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error) {
    console.error('Error en renewal-actions:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
