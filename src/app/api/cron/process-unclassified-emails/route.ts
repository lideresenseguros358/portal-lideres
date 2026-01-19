import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * CRON JOB: Procesar emails sin clasificar después de ventana de 24h
 * Frecuencia: Cada hora
 * 
 * Configurar en Supabase SQL Editor con el comando de schedule para ejecutar cada hora
 */

export async function POST(request: Request) {
  try {
    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await getSupabaseServer();
    
    // Buscar emails cuya ventana de agrupación ha expirado
    const { data: expiredEmails, error } = await supabase
      .from('unclassified_emails')
      .select('*')
      .eq('status', 'PENDING')
      .not('grouped_until', 'is', null)
      .lt('grouped_until', new Date().toISOString());

    if (error) {
      console.error('Error fetching expired emails:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!expiredEmails || expiredEmails.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: 'No emails with expired grouping window',
        count: 0 
      });
    }

    // Actualizar estado a GROUPED (listo para asignación manual)
    const { error: updateError } = await supabase
      .from('unclassified_emails')
      .update({ status: 'GROUPED' })
      .in('id', expiredEmails.map(e => e.id));

    if (updateError) {
      console.error('Error updating email status:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Agrupar emails por remitente o thread
    const groupedByThread: Record<string, typeof expiredEmails> = {};
    const groupedBySender: Record<string, typeof expiredEmails> = {};

    for (const email of expiredEmails) {
      // Agrupar por thread_id si existe
      if (email.thread_id) {
        if (!groupedByThread[email.thread_id]) {
          groupedByThread[email.thread_id] = [];
        }
        const threadGroup = groupedByThread[email.thread_id];
        if (threadGroup) {
          threadGroup.push(email);
        }
      }
      
      // Agrupar por remitente
      if (!groupedBySender[email.from_email]) {
        groupedBySender[email.from_email] = [];
      }
      const senderGroup = groupedBySender[email.from_email];
      if (senderGroup) {
        senderGroup.push(email);
      }
    }

    // Crear notificaciones para masters
    const masterEmails = [
      'yiraramos@lideresenseguros.com',
      'lucianieto@lideresenseguros.com',
    ];

    for (const masterEmail of masterEmails) {
      // Obtener user_id del master
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', masterEmail)
        .single();

      if (profile) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            broker_id: profile.id,
            target: '/cases/unclassified',
            title: `📧 ${expiredEmails.length} emails sin clasificar requieren asignación`,
            body: `Hay ${expiredEmails.length} emails que superaron la ventana de 24h y necesitan ser asignados manualmente`,
            notification_type: 'other',
            metadata: {
              count: expiredEmails.length,
              threads: Object.keys(groupedByThread).length,
              senders: Object.keys(groupedBySender).length,
            },
          });

        if (notifError) {
          console.error(`Error creating notification for ${masterEmail}:`, notifError);
        }
      }
    }

    // TODO: Intentar clasificación automática con IA
    // Para emails con confidence_score alta, podríamos auto-asignar
    // const highConfidenceEmails = expiredEmails.filter(e => 
    //   e.confidence_score && e.confidence_score >= 0.85
    // );
    // await autoAssignHighConfidenceEmails(highConfidenceEmails);

    return NextResponse.json({ 
      ok: true, 
      message: `Processed ${expiredEmails.length} unclassified emails`,
      count: expiredEmails.length,
      stats: {
        total: expiredEmails.length,
        threads: Object.keys(groupedByThread).length,
        senders: Object.keys(groupedBySender).length,
      },
    });

  } catch (error) {
    console.error('Unexpected error in process-unclassified-emails cron:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    error: 'Method not allowed. Use POST with proper authorization.' 
  }, { status: 405 });
}
