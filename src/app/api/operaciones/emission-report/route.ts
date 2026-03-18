/**
 * API Endpoint: Reporte de Fallo de Emisión (REPORTAR)
 * POST /api/operaciones/emission-report
 *
 * Creates an URGENT case in ops_cases when a policy emission fails
 * AFTER the PagueloFacil payment was already charged.
 * Contains full client data, vehicle data, payment info, and expedition documents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { generateTicketNumber } from '@/types/operaciones.types';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const body = await req.json();

    const {
      // Insurer info
      insurerName,
      ramo,          // 'AUTO'
      cobertura,     // 'COMPLETA' | 'DT'
      // Client data
      clientData,    // { primerNombre, primerApellido, segundoNombre, segundoApellido, cedula, fechaNacimiento, sexo, email, telefono, celular, direccion, ... }
      // Vehicle data
      vehicleData,   // { placa, vinChasis, motor, color, marca, modelo, anio, ... }
      // Quote data
      quoteData,     // { numcot, planType, annualPremium, deducible, ... }
      // Payment info
      paymentData,   // { pfCodOper, pfCardType, pfCardDisplay, amount, installments }
      // Emission error details
      emissionError, // string — the raw error message
      // Expedition documents (URLs or references)
      expedienteDocs, // { photos: string[], firma: string, debidaDiligencia: string }
    } = body;

    // Build the full details object for the case
    const details: Record<string, any> = {
      tipo_reporte: 'EMISION_FALLIDA',
      cobertura: cobertura || 'CC',
      // Full client data
      cliente: clientData || {},
      // Full vehicle data
      vehiculo: vehicleData || {},
      // Quote reference
      cotizacion: quoteData || {},
      // Payment confirmation
      pago: {
        confirmado: true,
        codOper: paymentData?.pfCodOper || 'N/A',
        cardType: paymentData?.pfCardType || '',
        cardDisplay: paymentData?.pfCardDisplay || '',
        monto: paymentData?.amount || 0,
        cuotas: paymentData?.installments || 1,
        fecha: new Date().toISOString(),
      },
      // Error details
      error: {
        mensaje: emissionError || 'Error desconocido durante emisión',
        timestamp: new Date().toISOString(),
      },
      // Expedition documents
      expediente: expedienteDocs || {},
    };

    const clientName = clientData
      ? `${clientData.primerNombre || ''} ${clientData.primerApellido || ''}`.trim()
      : 'Cliente desconocido';

    const ticket = generateTicketNumber('EMI');

    // Create the urgent case
    const { data: caseData, error: insertErr } = await supabase.from('ops_cases').insert({
      ticket,
      case_type: 'urgencia',
      status: 'pendiente',
      urgency_flag: true,
      severity: 'alta',
      category: 'emision_fallida',
      client_name: clientName,
      client_email: clientData?.email || null,
      client_phone: clientData?.celular || clientData?.telefono || null,
      cedula: clientData?.cedula || null,
      insurer_name: insurerName || null,
      ramo: ramo || 'AUTO',
      source: 'COTIZADOR_EMISION',
      details,
      metadata: {
        pfCodOper: paymentData?.pfCodOper || null,
        paymentAmount: paymentData?.amount || null,
        cobertura: cobertura || 'CC',
        numcot: quoteData?.numcot || null,
        emissionError: emissionError || null,
      },
    }).select().single();

    if (insertErr) throw insertErr;

    // Auto-assign to a master
    try {
      await supabase.rpc('assign_case_equilibrado', { p_case_id: caseData.id });
    } catch { /* non-fatal if RPC doesn't exist */ }

    // Create notification for all masters — URGENT
    try {
      await supabase.from('portal_notifications').insert({
        type: 'chat_urgent',
        title: `🚨 EMISIÓN FALLIDA — ${clientName}`,
        body: `Pago cobrado ($${paymentData?.amount || '?'}) pero emisión falló en ${insurerName || 'aseguradora'}. Requiere emisión manual URGENTE.`,
        link: '/operaciones/urgencias',
        target_role: 'master',
        target_user_id: null,
      });
    } catch { /* non-fatal */ }

    // Activity log
    try {
      await supabase.from('ops_activity_log').insert({
        user_id: null,
        action_type: 'case_created',
        entity_type: 'case',
        entity_id: caseData.id,
        metadata: {
          ticket,
          case_type: 'urgencia',
          source: 'COTIZADOR_EMISION',
          pfCodOper: paymentData?.pfCodOper || null,
          insurerName,
          emissionError,
        },
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      ticket,
      caseId: caseData.id,
    });
  } catch (err: any) {
    console.error('[EMISSION REPORT] Error creating case:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
