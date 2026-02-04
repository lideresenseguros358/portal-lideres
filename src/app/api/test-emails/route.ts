/**
 * API PARA PRUEBAS DE CORREOS
 * ============================
 * Endpoint para probar todos los tipos de correos del sistema
 * Envía correos con datos ficticios a javiersamudio@lideresenseguros.com
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';
import { verifyConnection } from '@/server/email/mailer';

const TEST_EMAIL = 'javiersamudio@lideresenseguros.com';

/**
 * Generar datos ficticios para cada tipo de correo
 */
function generateTestData(template: string): any {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const testData: Record<string, any> = {
    // RENOVACIONES
    renewalReminder: {
      brokerName: 'Juan Pérez (PRUEBA)',
      clientName: 'Cliente de Prueba S.A.',
      policyNumber: 'TEST-POL-2024-001',
      insurerName: 'Aseguradora de Prueba',
      renewalDate: nextWeek.toLocaleDateString('es-PA'),
      daysUntilRenewal: 7,
      premium: 1500.00,
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    renewalConfirm: {
      masterName: 'Admin Master (PRUEBA)',
      clientName: 'Cliente de Prueba S.A.',
      brokerName: 'Juan Pérez',
      policyNumber: 'TEST-POL-2024-001',
      insurerName: 'Aseguradora de Prueba',
      renewalDate: nextWeek.toLocaleDateString('es-PA'),
      confirmUrl: `${process.env.APP_BASE_URL}/api/renewals/confirm?test=true`,
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    
    // CUMPLEAÑOS
    birthdayClient: {
      brokerName: 'Juan Pérez (PRUEBA)',
      clientName: 'Cliente de Prueba',
      clientId: 'test-client-id',
      policyCount: 3,
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    birthdayBroker: {
      brokerName: 'Juan Pérez (PRUEBA)',
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    
    // COMISIONES
    commissionPaid: {
      brokerName: 'Juan Pérez (PRUEBA)',
      fortnightName: 'Quincena 24 (PRUEBA)',
      startDate: '2024-12-01',
      endDate: '2024-12-15',
      netAmount: 5500.75,
      itemCount: 12,
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    commissionAdjustmentPaid: {
      brokerName: 'Juan Pérez (PRUEBA)',
      adjustmentType: 'Ajuste Manual (PRUEBA)',
      amount: 350.00,
      reason: 'Corrección de comisión por error de cálculo',
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    
    // PRELIMINAR
    preliminarIncomplete: {
      brokerName: 'Juan Pérez (PRUEBA)',
      clientName: 'Cliente Incompleto de Prueba',
      missingFields: ['Cédula/RUC', 'Email', 'Teléfono'],
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    
    // MOROSIDAD
    morosidadImported: {
      brokerName: 'Juan Pérez (PRUEBA)',
      totalRecords: 5,
      withCases: 3,
      withoutCases: 2,
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    
    // PENDIENTES
    pendienteCreated: {
      brokerName: 'Juan Pérez (PRUEBA)',
      ticket: 'PEND-TEST-001',
      clientName: 'Cliente de Prueba',
      insurerName: 'Aseguradora de Prueba',
      policyNumber: 'TEST-POL-001',
      description: 'Descripción de prueba del trámite',
      priority: 'alta',
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    pendienteUpdated: {
      brokerName: 'Juan Pérez (PRUEBA)',
      ticket: 'PEND-TEST-001',
      clientName: 'Cliente de Prueba',
      status: 'En Proceso',
      updateDetails: 'Actualización de prueba del estado del trámite',
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    pendienteClosedApproved: {
      brokerName: 'Juan Pérez (PRUEBA)',
      ticket: 'PEND-TEST-001',
      clientName: 'Cliente de Prueba',
      insurerName: 'Aseguradora de Prueba',
      policyNumber: 'TEST-POL-001',
      resolution: 'Trámite aprobado satisfactoriamente',
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    pendienteClosedRejected: {
      brokerName: 'Juan Pérez (PRUEBA)',
      ticket: 'PEND-TEST-001',
      clientName: 'Cliente de Prueba',
      insurerName: 'Aseguradora de Prueba',
      policyNumber: 'TEST-POL-001',
      reason: 'Documentación incompleta',
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    pendienteAplazado: {
      brokerName: 'Juan Pérez (PRUEBA)',
      ticket: 'PEND-TEST-001',
      clientName: 'Cliente de Prueba',
      aplazadoMonths: 3,
      aplazadoUntil: nextWeek.toLocaleDateString('es-PA'),
      reason: 'Cliente solicitó esperar 3 meses',
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    pendientesDailyDigest: {
      brokerName: 'Juan Pérez (PRUEBA)',
      totalCases: 8,
      urgentCount: 3,
      cases: [
        {
          ticket: 'PEND-TEST-001',
          clientName: 'Cliente A',
          status: 'urgente',
          daysOpen: 5,
        },
        {
          ticket: 'PEND-TEST-002',
          clientName: 'Cliente B',
          status: 'normal',
          daysOpen: 2,
        },
      ],
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    
    // AGENDA
    agendaCreated: {
      userName: 'Juan Pérez (PRUEBA)',
      eventTitle: 'Junta Mensual de Agencia (PRUEBA)',
      description: 'Reunión mensual para revisar resultados y planificar estrategias',
      eventDate: 'lunes, 15 de enero de 2025',
      eventTime: '10:00 AM',
      location: 'Oficina Principal',
      createdBy: 'Admin Master',
      needsRsvp: true,
      rsvpYesUrl: `${process.env.APP_BASE_URL}/api/agenda/rsvp?test=yes`,
      rsvpNoUrl: `${process.env.APP_BASE_URL}/api/agenda/rsvp?test=no`,
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    agendaUpdated: {
      userName: 'Juan Pérez (PRUEBA)',
      eventTitle: 'Junta Mensual de Agencia (PRUEBA)',
      description: 'Reunión mensual ACTUALIZADA',
      eventDate: 'martes, 16 de enero de 2025',
      eventTime: '02:00 PM',
      location: 'Oficina Principal - Sala B',
      updatedBy: 'Admin Master',
      changes: ['Fecha cambiada', 'Hora cambiada', 'Ubicación cambiada'],
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    agendaDeleted: {
      userName: 'Juan Pérez (PRUEBA)',
      eventTitle: 'Junta Mensual de Agencia (PRUEBA)',
      eventDate: 'lunes, 15 de enero de 2025',
      eventTime: '10:00 AM',
      location: 'Oficina Principal',
      deletedBy: 'Admin Master',
      reason: 'Evento cancelado por motivos de fuerza mayor',
      rescheduled: false,
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
    agendaReminder: {
      userName: 'Juan Pérez (PRUEBA)',
      eventTitle: 'Junta Mensual de Agencia (PRUEBA)',
      description: 'Reunión mensual para revisar resultados',
      eventDate: 'mañana, 15 de enero de 2025',
      eventTime: '10:00 AM',
      location: 'Oficina Principal',
      portalUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    },
  };
  
  return testData[template] || {};
}

/**
 * Obtener subject para cada tipo de correo
 */
function getSubject(template: string): string {
  const subjects: Record<string, string> = {
    renewalReminder: '🔔 Recordatorio: Renovación próxima (PRUEBA)',
    renewalConfirm: '✅ Confirmar renovación de póliza (PRUEBA)',
    birthdayClient: '🎂 Feliz cumpleaños a tu cliente (PRUEBA)',
    birthdayBroker: '🎉 ¡Feliz cumpleaños! (PRUEBA)',
    commissionPaid: '💰 Comisión pagada (PRUEBA)',
    commissionAdjustmentPaid: '💵 Ajuste de comisión aplicado (PRUEBA)',
    preliminarIncomplete: '⚠️ Cliente con información incompleta (PRUEBA)',
    morosidadImported: '📊 Reporte de morosidad importado (PRUEBA)',
    pendienteCreated: '📝 Nuevo trámite creado (PRUEBA)',
    pendienteUpdated: '🔄 Trámite actualizado (PRUEBA)',
    pendienteClosedApproved: '✅ Trámite aprobado (PRUEBA)',
    pendienteClosedRejected: '❌ Trámite rechazado (PRUEBA)',
    pendienteAplazado: '⏸️ Trámite aplazado (PRUEBA)',
    pendientesDailyDigest: '📋 Resumen diario de trámites (PRUEBA)',
    agendaCreated: '📅 Nuevo evento en agenda (PRUEBA)',
    agendaUpdated: '🔄 Evento actualizado (PRUEBA)',
    agendaDeleted: '🗑️ Evento cancelado (PRUEBA)',
    agendaReminder: '📅 Recordatorio: Evento mañana (PRUEBA)',
  };
  
  return subjects[template] || `Correo de prueba: ${template}`;
}

/**
 * POST /api/test-emails
 * Enviar correo de prueba de un tipo específico
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template, fromType = 'PORTAL' } = body;
    
    console.log(`[TEST-EMAIL] Solicitado envío de prueba: ${template}`);
    
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template es requerido' },
        { status: 400 }
      );
    }
    
    // 1. Verificar conexión SMTP primero
    console.log(`[TEST-EMAIL] Verificando conexión SMTP ${fromType}...`);
    const isConnected = await verifyConnection(fromType);
    if (!isConnected) {
      return NextResponse.json(
        { success: false, error: `No se pudo conectar al servidor SMTP ${fromType}` },
        { status: 500 }
      );
    }
    
    // 2. Generar datos de prueba
    const testData = generateTestData(template);
    const subject = getSubject(template);
    
    console.log(`[TEST-EMAIL] Generando HTML para template: ${template}`);
    // 3. Renderizar template
    const html = renderEmailTemplate(template, testData);
    
    if (!html) {
      return NextResponse.json(
        { success: false, error: `Template '${template}' no encontrado` },
        { status: 404 }
      );
    }
    
    // 4. Enviar correo
    console.log(`[TEST-EMAIL] Enviando correo de prueba a ${TEST_EMAIL}...`);
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject,
      html,
      fromType: fromType as 'PORTAL' | 'TRAMITES',
      template: template as any,
      metadata: { test: true, templateName: template },
    });
    
    if (result.success) {
      console.log(`[TEST-EMAIL] ✓ Correo enviado exitosamente`);
      return NextResponse.json({
        success: true,
        message: `Correo de prueba enviado a ${TEST_EMAIL}`,
        messageId: result.messageId,
        template,
      });
    } else {
      console.error(`[TEST-EMAIL] ✗ Error enviando correo:`, result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('[TEST-EMAIL] Error inesperado:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test-emails
 * Verificar estado de conexiones SMTP
 */
export async function GET() {
  try {
    console.log('[TEST-EMAIL] Verificando conexiones SMTP...');
    
    const portalStatus = await verifyConnection('PORTAL');
    const tramitesStatus = await verifyConnection('TRAMITES');
    
    return NextResponse.json({
      success: true,
      smtp: {
        portal: portalStatus ? 'connected' : 'disconnected',
        tramites: tramitesStatus ? 'connected' : 'disconnected',
      },
      host: process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com',
      port: process.env.ZOHO_SMTP_PORT || '465',
    });
    
  } catch (error: any) {
    console.error('[TEST-EMAIL] Error verificando SMTP:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
