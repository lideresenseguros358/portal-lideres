/**
 * POST /api/paguelofacil/create-link
 * ===================================
 * Creates a PagueloFacil payment link (Enlace de Pago) by calling LinkDeamon.cfm.
 * Returns a checkout URL where the user will be redirected to complete payment.
 *
 * Request body:
 * - amount: number (required, min $1.00)
 * - description: string (required)
 * - policyRef?: string (custom reference, returned in PARM_1)
 * - cardType?: string (NEQUI,CASH,CLAVE,CARD,CRYPTO — comma-separated)
 * - expiresIn?: number (seconds, default 3600)
 * - customFields?: Record<string, string> (extra data for PF_CF)
 * - returnContext?: string (JSON string to persist in sessionStorage before redirect)
 *
 * Response:
 * - success: boolean
 * - checkoutUrl?: string (redirect user here)
 * - code?: string (PagueloFacil link code, e.g. LK-XXXXX)
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPagueloFacilConfig,
  buildReturnUrl,
  buildCustomFields,
  type PFCreateLinkResponse,
} from '@/lib/paguelofacil/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, description, policyRef, cardType, expiresIn, customFields } = body;

    // ── Validate required fields ──
    if (!amount || typeof amount !== 'number' || amount < 1) {
      return NextResponse.json(
        { success: false, error: 'Monto inválido. Mínimo $1.00 USD.' },
        { status: 400 }
      );
    }
    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Descripción es requerida.' },
        { status: 400 }
      );
    }

    // ── Get config ──
    const config = getPagueloFacilConfig();
    if (!config.cclw) {
      console.error('[PAGUELOFACIL] CCLW not configured');
      return NextResponse.json(
        { success: false, error: 'PagueloFacil no está configurado. Contacte al administrador.' },
        { status: 500 }
      );
    }

    // ── Build return URL (hex-encoded) ──
    const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000';
    const returnPath = process.env.NEXT_PUBLIC_PAGUELOFACIL_RETURN_PATH || '/cotizadores/pago-confirmado';
    const hexReturnUrl = buildReturnUrl(origin, returnPath);

    // ── Build custom fields (hex-encoded JSON) ──
    const cfData: Record<string, string> = {
      ...(customFields || {}),
      ...(policyRef ? { policyRef } : {}),
    };
    const hexCustomFields = Object.keys(cfData).length > 0
      ? buildCustomFields(cfData)
      : undefined;

    // ── Build POST body for LinkDeamon.cfm ──
    const params = new URLSearchParams();
    params.append('CCLW', config.cclw);
    params.append('CMTN', amount.toFixed(2));
    params.append('CDSC', description.substring(0, 150)); // Max 150 chars
    params.append('RETURN_URL', hexReturnUrl);

    if (hexCustomFields) {
      params.append('PF_CF', hexCustomFields);
    }
    if (policyRef) {
      params.append('PARM_1', policyRef);
    }
    if (cardType) {
      params.append('CARD_TYPE', cardType);
    }
    params.append('EXPIRES_IN', String(expiresIn || 3600));

    console.log('[PAGUELOFACIL] Creating payment link:', {
      amount,
      description: description.substring(0, 50),
      environment: config.environment,
      linkUrl: config.linkUrl,
    });

    // ── Call PagueloFacil LinkDeamon.cfm ──
    const response = await fetch(config.linkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[PAGUELOFACIL] LinkDeamon error:', response.status, text);
      return NextResponse.json(
        { success: false, error: `Error de PagueloFacil: HTTP ${response.status}` },
        { status: 502 }
      );
    }

    const result: PFCreateLinkResponse = await response.json();

    if (!result.success || result.headerStatus?.code !== 200 || !result.data?.url) {
      console.error('[PAGUELOFACIL] LinkDeamon failed:', result);
      return NextResponse.json(
        {
          success: false,
          error: result.message || result.headerStatus?.description || 'Error creando enlace de pago',
        },
        { status: 400 }
      );
    }

    console.log('[PAGUELOFACIL] ✅ Payment link created:', result.data.code);

    return NextResponse.json({
      success: true,
      checkoutUrl: result.data.url,
      code: result.data.code,
      environment: config.environment,
    });

  } catch (error: any) {
    console.error('[PAGUELOFACIL] create-link error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
