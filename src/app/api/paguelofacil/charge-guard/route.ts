/**
 * POST /api/paguelofacil/charge-guard
 * =====================================
 * Idempotency guard — must be called BEFORE /api/paguelofacil/charge.
 * Checks multiple barriers to prevent duplicate charges:
 *
 * Barrier 1: Same quote (numcot/idCotizacion) already has a confirmed PF payment.
 * Barrier 2: Same vehicle plate already has a pending ops_cases (emision_fallida) case.
 * Barrier 3: Same cedula has a recent confirmed payment in the last 24h for same insurer.
 *
 * Returns:
 * - { allowed: true }  — safe to proceed with charge
 * - { allowed: false, reason: string, blocked: true, blockedMessage: string } — BLOCK
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const body = await req.json();

    const {
      numcot,        // Quote ID / cotización number
      placa,         // Vehicle plate number
      cedula,        // Client cedula
      insurer,       // Insurer name
    } = body;

    // ═══ BARRIER 1: Same quote already has a confirmed PF payment ═══
    if (numcot) {
      const { data: existingPayment } = await supabase
        .from('adm_cot_payments')
        .select('id, status, pf_cod_oper, nro_poliza, created_at')
        .or(`nro_poliza.ilike.%${numcot}%`)
        .in('status', ['CONFIRMADO_PF', 'AGRUPADO', 'PAGADO'])
        .limit(1)
        .maybeSingle();

      if (existingPayment) {
        console.log(`[CHARGE-GUARD] ⛔ Blocked: quote ${numcot} already has payment ${existingPayment.id} (${existingPayment.status})`);
        return NextResponse.json({
          allowed: false,
          blocked: true,
          reason: 'duplicate_quote_payment',
          blockedMessage: 'Ya se registró un pago confirmado para esta cotización. Su caso está siendo procesado por nuestro equipo. Por favor espere a ser contactado.',
        });
      }
    }

    // ═══ BARRIER 2: Same plate has a pending emission case in ops_cases ═══
    if (placa) {
      const normalizedPlate = placa.replace(/[\s\-]/g, '').toUpperCase();

      // Search in ops_cases details->vehiculo->placa for pending/en_atencion emission cases
      const { data: existingCases } = await supabase
        .from('ops_cases')
        .select('id, ticket, status, created_at, details')
        .eq('category', 'emision_fallida')
        .in('status', ['pendiente', 'en_atencion'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (existingCases && existingCases.length > 0) {
        const matchingCase = existingCases.find((c: any) => {
          const casePlate = c.details?.vehiculo?.placa;
          if (!casePlate) return false;
          return casePlate.replace(/[\s\-]/g, '').toUpperCase() === normalizedPlate;
        });

        if (matchingCase) {
          console.log(`[CHARGE-GUARD] ⛔ Blocked: plate ${normalizedPlate} has pending case ${matchingCase.ticket}`);
          return NextResponse.json({
            allowed: false,
            blocked: true,
            reason: 'pending_emission_case',
            ticket: matchingCase.ticket,
            blockedMessage: `Ya existe un caso de emisión en trámite (${matchingCase.ticket}) para este vehículo. Nuestro equipo lo está revisando y se comunicará con usted en breve. No se realizará ningún cargo adicional.`,
          });
        }
      }
    }

    // ═══ BARRIER 3: Same cedula + insurer has a recent confirmed payment (last 24h) ═══
    if (cedula && insurer) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: recentPayment } = await supabase
        .from('adm_cot_payments')
        .select('id, status, amount, created_at, nro_poliza')
        .eq('cedula', cedula)
        .eq('insurer', insurer)
        .in('status', ['CONFIRMADO_PF', 'AGRUPADO', 'PAGADO'])
        .gte('created_at', twentyFourHoursAgo)
        .limit(1)
        .maybeSingle();

      if (recentPayment) {
        console.log(`[CHARGE-GUARD] ⛔ Blocked: cedula ${cedula} has recent payment ${recentPayment.id} for ${insurer}`);
        return NextResponse.json({
          allowed: false,
          blocked: true,
          reason: 'recent_duplicate_payment',
          blockedMessage: 'Se detectó un pago reciente para esta cédula con la misma aseguradora. Su caso está siendo revisado para evitar cargos duplicados. Por favor espere a ser contactado.',
        });
      }
    }

    // ═══ ALL CLEAR — safe to charge ═══
    return NextResponse.json({ allowed: true });

  } catch (err: any) {
    console.error('[CHARGE-GUARD] Error:', err);
    // On error, ALLOW the charge to proceed (fail open) — better to risk a duplicate
    // than to block a legitimate customer. The emission-report flow handles duplicates.
    return NextResponse.json({ allowed: true, warning: 'Guard check failed, proceeding anyway' });
  }
}
