/**
 * EMAIL NOTIFICATIONS WITH RESEND
 * 
 * Este módulo está preparado para integración futura con Resend
 * para envío de notificaciones por email.
 * 
 * TODO: Implementar con Resend API
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface TicketEmailData {
  ticket_ref: string;
  client_name?: string;
  status?: string;
  sla_date?: string;
  link?: string;
}

/**
 * Envía notificación de ticket creado
 */
export async function sendTicketCreatedEmail(
  to: EmailRecipient,
  ticketData: TicketEmailData
): Promise<{ ok: boolean; error?: string }> {
  
  // TODO: Implementar con Resend
  // const resend = new Resend(process.env.RESEND_API_KEY);
  
  // await resend.emails.send({
  //   from: 'Sistema de Tickets <noreply@lideresenseguros.com>',
  //   to: [to.email],
  //   subject: `Nuevo ticket creado: ${ticketData.ticket_ref}`,
  //   html: `
  //     <h1>Ticket ${ticketData.ticket_ref} creado</h1>
  //     <p>Cliente: ${ticketData.client_name}</p>
  //     <p><a href="${ticketData.link}">Ver detalles</a></p>
  //   `,
  // });

  console.log('[EMAIL] Ticket created notification (placeholder):', {
    to: to.email,
    ticket: ticketData.ticket_ref,
  });

  return { ok: true };
}

/**
 * Envía notificación de cambio de estado
 */
export async function sendTicketStatusChangedEmail(
  to: EmailRecipient,
  ticketData: TicketEmailData & { oldStatus: string; newStatus: string }
): Promise<{ ok: boolean; error?: string }> {
  
  console.log('[EMAIL] Status changed notification (placeholder):', {
    to: to.email,
    ticket: ticketData.ticket_ref,
    transition: `${ticketData.oldStatus} → ${ticketData.newStatus}`,
  });

  return { ok: true };
}

/**
 * Envía alerta de SLA próximo a vencer
 */
export async function sendSLAAlertEmail(
  to: EmailRecipient,
  ticketData: TicketEmailData & { daysRemaining: number }
): Promise<{ ok: boolean; error?: string }> {
  
  console.log('[EMAIL] SLA alert (placeholder):', {
    to: to.email,
    ticket: ticketData.ticket_ref,
    daysRemaining: ticketData.daysRemaining,
  });

  return { ok: true };
}

/**
 * Envía notificación de caso aplazado que requiere decisión
 */
export async function sendAplazadoNotificationEmail(
  to: EmailRecipient,
  caseData: {
    ticket_ref: string;
    client_name?: string;
    postponed_until: string;
    aplazar_reason?: string;
    link?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  
  console.log('[EMAIL] Aplazado notification (placeholder):', {
    to: to.email,
    ticket: caseData.ticket_ref,
    postponedUntil: caseData.postponed_until,
  });

  return { ok: true };
}

/**
 * Envía notificación de email sin clasificar
 */
export async function sendUnclassifiedEmailNotification(
  to: EmailRecipient,
  emailData: {
    from_email: string;
    subject?: string;
    count: number;
    link?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  
  console.log('[EMAIL] Unclassified email notification (placeholder):', {
    to: to.email,
    count: emailData.count,
  });

  return { ok: true };
}

/**
 * Envía resumen diario al master
 */
export async function sendDailySummaryEmail(
  to: EmailRecipient,
  summary: {
    pending_cases: number;
    expiring_sla: number;
    aplazados_to_review: number;
    unclassified_emails: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  
  console.log('[EMAIL] Daily summary (placeholder):', {
    to: to.email,
    summary,
  });

  return { ok: true };
}

/**
 * Envía notificación a broker de nuevo caso asignado
 */
export async function sendBrokerCaseAssignedEmail(
  to: EmailRecipient,
  caseData: {
    ticket_ref: string;
    client_name?: string;
    section: string;
    link?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  
  console.log('[EMAIL] Broker case assigned (placeholder):', {
    to: to.email,
    ticket: caseData.ticket_ref,
  });

  return { ok: true };
}

/**
 * Plantilla HTML base para emails
 */
function getEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #010139 0%, #020270 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e0e0e0; }
        .button { background: #8AAA19; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Líderes en Seguros</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Sistema de Gestión de Casos</p>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>Este es un email automático del sistema de tickets.</p>
          <p>© 2026 Líderes en Seguros. Todos los derechos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
