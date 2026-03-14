/**
 * POST /api/paguelofacil/charge
 * ==============================
 * Processes a direct card charge (AUTH_CAPTURE / Sale) via PagueloFacil REST API.
 * Uses the @shoopiapp/paguelofacil SDK for server-to-server card processing.
 *
 * Request body:
 * - amount: number (required, min $1.00 USD)
 * - description: string (required)
 * - concept: string (required)
 * - cardNumber: string (raw digits, no spaces)
 * - expMonth: string ("01"-"12")
 * - expYear: string (2-digit year, e.g. "30")
 * - cvv: string
 * - cardholderName: string (full name)
 * - cardType: "VISA" | "MASTERCARD"
 * - email?: string (cardholder email)
 * - phone?: string (cardholder phone)
 * - customFieldValues?: Array<[string, string, string]>
 *
 * Response:
 * - success: boolean
 * - codOper?: string (PagueloFacil operation code for reference)
 * - status?: number (1 = approved, 0 = declined)
 * - displayNum?: string (last 4 digits)
 * - totalPay?: string
 * - authStatus?: string
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';

// @ts-expect-error — @shoopiapp/paguelofacil has no type declarations
import PagueloFacil from '@shoopiapp/paguelofacil';

// ── User-friendly error messages (Spanish) for PagueloFacil codes ──
const PF_ERROR_MAP: Record<string, string> = {
  'Invalid Card Type': 'Tipo de tarjeta inválido. Verifique el número de su tarjeta.',
  'Invalid token': 'Error de configuración del sistema de pagos. Contacte al administrador.',
  'Invalid Card Number': 'Número de tarjeta inválido. Verifique e intente nuevamente.',
  'Expired Card': 'La tarjeta está vencida. Use una tarjeta vigente.',
  'Insufficient Funds': 'Fondos insuficientes en la tarjeta.',
  'Transaction Declined': 'Transacción rechazada por el banco emisor.',
  'Do Not Honor': 'El banco rechazó la transacción. Contacte a su banco.',
  'Invalid Transaction': 'Transacción inválida. Verifique los datos e intente nuevamente.',
  'Card Restricted': 'Tarjeta restringida. Contacte a su banco emisor.',
  'Lost Card': 'Tarjeta reportada como perdida. Contacte a su banco.',
  'Stolen Card': 'Tarjeta reportada como robada. Contacte a su banco.',
  'Pick Up Card': 'Tarjeta inactiva o bloqueada. Contacte a su banco.',
  'Exceeds Amount Limit': 'El monto excede el límite permitido por su tarjeta.',
  'Invalid CVV': 'Código de seguridad (CVV) inválido.',
  'Invalid Expiration': 'Fecha de vencimiento inválida.',
  'INVALID SERVICE GATEWAY OR DATA GATEWAY': 'Error de conexión con el procesador de pagos. Intente nuevamente.',
};

function translatePfError(rawMsg: string): string {
  // Check exact match
  if (PF_ERROR_MAP[rawMsg]) return PF_ERROR_MAP[rawMsg];
  // Check partial match (case-insensitive)
  const lower = rawMsg.toLowerCase();
  for (const [key, val] of Object.entries(PF_ERROR_MAP)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  // If the raw message looks like English technical jargon, wrap it
  if (/^[A-Z\s_]+$/.test(rawMsg) || rawMsg.includes('Invalid') || rawMsg.includes('Error')) {
    return `Error del procesador de pagos: ${rawMsg}`;
  }
  return rawMsg;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      amount,
      description,
      concept,
      cardNumber,
      expMonth,
      expYear,
      cvv,
      cardholderName,
      cardType,
      email,
      phone,
      customFieldValues,
    } = body;

    // ── Validate required fields ──
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
    if (!cardNumber || !expMonth || !expYear || !cvv || !cardholderName || !cardType) {
      return NextResponse.json(
        { success: false, error: 'Datos de tarjeta incompletos.' },
        { status: 400 }
      );
    }

    // ── Get credentials ──
    const cclw = process.env.PAGUELOFACIL_CCLW;
    const token = process.env.PAGUELOFACIL_API_TOKEN;
    const env = process.env.PAGUELOFACIL_ENVIRONMENT || 'sandbox';

    if (!cclw || !token) {
      console.error('[PAGUELOFACIL] CCLW or API_TOKEN not configured');
      return NextResponse.json(
        { success: false, error: 'PagueloFacil no está configurado. Contacte al administrador.' },
        { status: 500 }
      );
    }

    // ── Map environment for SDK ──
    const sdkEnv = env === 'production' ? 'production' : 'development';

    // ── Initialize SDK ──
    const pf = new PagueloFacil(cclw, token, sdkEnv);

    // ── Build payment info ──
    const paymentInfo: Record<string, any> = {
      amount: Number(amount),
      taxAmount: 0.0,
      email: email || 'noreply@lideresenseguros.com',
      phone: phone || '60000000',
      concept: concept.substring(0, 150),
      description: description.substring(0, 150),
    };

    if (customFieldValues && Array.isArray(customFieldValues)) {
      paymentInfo.customFieldValues = customFieldValues;
    }

    // ── Build card info ──
    const nameParts = cardholderName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const cardInfo = {
      cardNumber: cardNumber.replace(/\s/g, ''),
      expMonth: String(expMonth),
      expYear: String(expYear),
      cvv: String(cvv),
      firstName,
      lastName,
      cardType: cardType === 'VISA' ? 'VISA' : 'MASTERCARD',
    };

    console.log('[PAGUELOFACIL] Processing AuthCapture:', {
      amount,
      concept: concept.substring(0, 50),
      cardType,
      displayNum: `****${cardNumber.slice(-4)}`,
      environment: sdkEnv,
    });

    // ── Execute AUTH_CAPTURE (Sale) ──
    const response = await pf.AuthCapture(paymentInfo, cardInfo);

    console.log('[PAGUELOFACIL] AuthCapture response:', {
      success: response?.success,
      code: response?.headerStatus?.code,
      codOper: response?.data?.codOper,
      status: response?.data?.status,
      operationType: response?.data?.operationType,
    });

    // ── Check result ──
    if (!response?.success || response?.headerStatus?.code !== 200) {
      const rawErrorMsg = response?.message
        || response?.headerStatus?.description
        || 'Error procesando el pago';
      console.error('[PAGUELOFACIL] AuthCapture failed:', response);
      return NextResponse.json(
        {
          success: false,
          error: translatePfError(rawErrorMsg),
          code: response?.headerStatus?.code,
          messageSys: response?.data?.messageSys,
        },
        { status: 400 }
      );
    }

    // ── Check transaction status (1 = approved, 0 = declined) ──
    const txData = response.data;
    if (!txData?.status || txData.status !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: translatePfError(txData?.messageSys || 'Transacción denegada por el banco emisor.'),
          codOper: txData?.codOper,
          authStatus: txData?.authStatus,
          status: txData?.status,
        },
        { status: 402 } // Payment Required
      );
    }

    // ── Success ──
    console.log('[PAGUELOFACIL] ✅ Payment approved:', txData.codOper);

    return NextResponse.json({
      success: true,
      codOper: txData.codOper,
      status: txData.status,
      displayNum: txData.displayNum,
      totalPay: txData.totalPay,
      authStatus: txData.authStatus,
      operationType: txData.operationType,
      cardType: txData.cardType || txData.type,
      date: txData.date,
    });

  } catch (error: any) {
    console.error('[PAGUELOFACIL] charge error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
