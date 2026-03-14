/**
 * GET /api/paguelofacil/verify?codOper=XXXXX
 * ============================================
 * Verifies a transaction status by querying PagueloFacil's REST API.
 * Uses the merchant's accessToken to query transaction details.
 *
 * Query params:
 * - codOper: string (required) — the operation code from PagueloFacil
 *
 * Response:
 * - success: boolean
 * - transaction?: PFTransactionRecord
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPagueloFacilConfig } from '@/lib/paguelofacil/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codOper = searchParams.get('codOper');

    if (!codOper) {
      return NextResponse.json(
        { success: false, error: 'codOper es requerido' },
        { status: 400 }
      );
    }

    const config = getPagueloFacilConfig();
    if (!config.accessToken) {
      console.error('[PAGUELOFACIL] API token not configured');
      return NextResponse.json(
        { success: false, error: 'PagueloFacil API token no configurado' },
        { status: 500 }
      );
    }

    // Query PagueloFacil REST API for transaction details
    const queryUrl = `${config.apiBaseUrl}/PFManagementServices/api/v1/MerchantTransactions?codOper=${encodeURIComponent(codOper)}`;

    console.log('[PAGUELOFACIL] Verifying transaction:', codOper);

    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[PAGUELOFACIL] Verify error:', response.status, text);
      return NextResponse.json(
        { success: false, error: `Error consultando transacción: HTTP ${response.status}` },
        { status: 502 }
      );
    }

    const result = await response.json();

    // PagueloFacil API wraps data in headerStatus + data structure
    if (result.headerStatus?.code !== 200) {
      return NextResponse.json(
        {
          success: false,
          error: result.headerStatus?.description || 'Transacción no encontrada',
        },
        { status: 404 }
      );
    }

    const tx = result.data;
    const isApproved = tx?.status === 1;

    console.log('[PAGUELOFACIL] Transaction verified:', {
      codOper,
      status: isApproved ? 'APPROVED' : 'DECLINED',
      amount: tx?.totalPay,
    });

    return NextResponse.json({
      success: true,
      approved: isApproved,
      transaction: {
        codOper: tx?.codOper || codOper,
        totalPay: tx?.totalPay || '0',
        status: tx?.status,
        operationType: tx?.operationType,
        displayNum: tx?.displayNum,
        cardType: tx?.cardType || tx?.type,
        userName: tx?.userName || tx?.name,
        email: tx?.email,
        date: tx?.date,
        description: tx?.description,
      },
    });

  } catch (error: any) {
    console.error('[PAGUELOFACIL] verify error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
