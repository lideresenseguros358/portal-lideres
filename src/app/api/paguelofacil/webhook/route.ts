/**
 * POST /api/paguelofacil/webhook
 * ===============================
 * Receives payment confirmation webhooks from PagueloFacil.
 * PagueloFacil sends a POST with transaction details after each payment.
 *
 * This endpoint:
 * 1. Validates the incoming payload
 * 2. Logs the transaction
 * 3. Can be extended to update payment records in Supabase
 *
 * NOTE: Configure this URL in PagueloFacil's webhook settings:
 *   https://portal.lideresenseguros.com/api/paguelofacil/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { type PFWebhookPayload } from '@/lib/paguelofacil/config';

export async function POST(request: NextRequest) {
  try {
    const payload: PFWebhookPayload = await request.json();

    const isApproved = payload.status === 1;
    const logPrefix = isApproved ? '✅' : '❌';

    console.log(
      `[PAGUELOFACIL WEBHOOK] ${logPrefix} Transaction ${payload.codOper}:`,
      {
        status: isApproved ? 'APPROVED' : 'DECLINED',
        operationType: payload.operationType,
        amount: payload.totalPay,
        requestedAmount: payload.requestPayAmount,
        cardType: payload.cardType,
        displayNum: payload.displayNum,
        email: payload.email,
        userName: payload.userName,
        date: payload.date,
        description: payload.description,
        authStatus: payload.authStatus,
        messageSys: payload.messageSys,
      }
    );

    // ── TODO: Update payment record in Supabase ──
    // When adm_cot_payments table is connected, update the payment status here:
    // if (isApproved) {
    //   await supabase.from('adm_cot_payments').update({
    //     status: 'paid',
    //     pf_cod_oper: payload.codOper,
    //     pf_card_type: payload.cardType,
    //     pf_display_num: payload.displayNum,
    //     pf_auth_status: payload.authStatus,
    //     paid_at: payload.date,
    //   }).eq('pf_link_code', extractLinkCode(payload));
    // }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true, status: isApproved ? 'approved' : 'declined' });

  } catch (error: any) {
    console.error('[PAGUELOFACIL WEBHOOK] Error processing webhook:', error);
    // Still return 200 to prevent PagueloFacil from retrying
    return NextResponse.json({ received: true, error: 'processing_error' });
  }
}

// Allow GET for webhook health check
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'paguelofacil-webhook' });
}
