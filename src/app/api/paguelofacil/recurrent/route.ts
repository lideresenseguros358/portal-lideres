/**
 * POST /api/paguelofacil/recurrent
 * =================================
 * Registers a recurring charge schedule with PagueloFacil.
 * Uses the codOper from a previous AuthCapture to charge the same card
 * on a monthly basis without requiring card details again.
 *
 * Request body:
 * - codOper: string (required — operation code from the first AuthCapture)
 * - amount: number (required — amount per installment, min $1.00 USD)
 * - description: string (required)
 * - concept: string (required)
 * - email: string (required)
 * - phone: string (optional)
 * - totalInstallments: number (total installments including the first already charged)
 * - policyNumber?: string (for reference)
 *
 * Response:
 * - success: boolean
 * - codOper?: string (recurrence operation code)
 * - message?: string
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';

import PagueloFacil from '@shoopiapp/paguelofacil';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      codOper,
      amount,
      description,
      concept,
      email,
      phone,
      totalInstallments,
      policyNumber,
    } = body;

    // ── Validate required fields ──
    if (!codOper) {
      return NextResponse.json(
        { success: false, error: 'Código de operación (codOper) es requerido para recurrencia.' },
        { status: 400 }
      );
    }
    if (!amount || typeof amount !== 'number' || amount < 1) {
      return NextResponse.json(
        { success: false, error: 'Monto inválido. Mínimo $1.00 USD.' },
        { status: 400 }
      );
    }
    if (!description || !concept) {
      return NextResponse.json(
        { success: false, error: 'Descripción y concepto son requeridos.' },
        { status: 400 }
      );
    }

    // ── Get credentials ──
    const cclw = process.env.PAGUELOFACIL_CCLW;
    const token = process.env.PAGUELOFACIL_API_TOKEN;
    const env = process.env.PAGUELOFACIL_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');

    if (!cclw || !token) {
      console.error('[PAGUELOFACIL] CCLW or API_TOKEN not configured');
      return NextResponse.json(
        { success: false, error: 'PagueloFacil no está configurado. Contacte al administrador.' },
        { status: 500 }
      );
    }

    const sdkEnv = env === 'production' ? 'production' : 'development';
    const pf = new PagueloFacil(cclw, token, sdkEnv);

    // ── Build recurrence info ──
    const recurrentInfo = {
      amount: Number(amount),
      taxAmount: 0.0,
      email: email || 'noreply@lideresenseguros.com',
      phone: phone || '60000000',
      concept: concept.substring(0, 150),
      description: description.substring(0, 150),
      codOper,
    };

    console.log('[PAGUELOFACIL] Registering RECURRENT:', {
      codOper,
      amount,
      concept: concept.substring(0, 50),
      totalInstallments,
      policyNumber,
      environment: sdkEnv,
    });

    // ── Execute RECURRENT ──
    const response = await pf.Recurrent(recurrentInfo);

    console.log('[PAGUELOFACIL] Recurrent response:', {
      success: response?.success,
      code: response?.headerStatus?.code,
      codOper: response?.data?.codOper,
      status: response?.data?.status,
    });

    // ── Check result ──
    if (!response?.success || response?.headerStatus?.code !== 200) {
      const errorMsg = response?.message
        || response?.headerStatus?.description
        || 'Error registrando pago recurrente';
      console.error('[PAGUELOFACIL] Recurrent failed:', response);
      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          code: response?.headerStatus?.code,
        },
        { status: 400 }
      );
    }

    const txData = response.data;

    // ── Check status ──
    if (txData?.status !== undefined && txData.status !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: txData?.messageSys || 'Error al registrar la recurrencia de pago.',
          codOper: txData?.codOper,
          status: txData?.status,
        },
        { status: 402 }
      );
    }

    console.log('[PAGUELOFACIL] ✅ Recurrent registered:', txData?.codOper || codOper);

    return NextResponse.json({
      success: true,
      codOper: txData?.codOper || codOper,
      status: txData?.status,
      totalPay: txData?.totalPay,
      message: `Pago recurrente registrado. ${totalInstallments ? `${totalInstallments - 1} cuota(s) restante(s) se cobrarán automáticamente.` : ''}`,
    });

  } catch (error: any) {
    console.error('[PAGUELOFACIL] recurrent error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
