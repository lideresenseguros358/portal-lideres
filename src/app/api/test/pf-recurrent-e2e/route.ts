/**
 * GET /api/test/pf-recurrent-e2e
 * ================================
 * E2E smoke test for PagueloFacil recurrence flow:
 *   1. AuthCapture (charge sandbox test card) → get codOper
 *   2. Recurrent (register recurrence with that codOper) → get recurrence codOper
 *
 * Uses PF sandbox test card: 5517747952039692 (MC, exp 01/30, cvv 123)
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/security/api-guard';
import PagueloFacil from '@shoopiapp/paguelofacil';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authErr = requireCronSecret(request);
  if (authErr) return authErr;

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.PAGUELOFACIL_ENVIRONMENT || 'sandbox',
    step1_authCapture: null,
    step2_recurrent: null,
    summary: '',
  };

  try {
    // ── Validate config ──
    const cclw = process.env.PAGUELOFACIL_CCLW;
    const token = process.env.PAGUELOFACIL_API_TOKEN;
    const env = process.env.PAGUELOFACIL_ENVIRONMENT || 'sandbox';

    if (!cclw || !token) {
      return NextResponse.json({
        ...results,
        summary: '❌ PAGUELOFACIL_CCLW or PAGUELOFACIL_API_TOKEN not configured',
      }, { status: 500 });
    }

    if (env === 'production') {
      return NextResponse.json({
        ...results,
        summary: '🛑 REFUSED — will not run E2E test in production environment',
      }, { status: 400 });
    }

    const sdkEnv = 'development'; // Always sandbox for E2E
    const pf = new PagueloFacil(cclw, token, sdkEnv);

    // ═══ STEP 1: AuthCapture with sandbox test card ═══
    const chargeAmount = 5.00; // $5 USD test charge
    const paymentInfo = {
      amount: chargeAmount,
      taxAmount: 0.0,
      email: 'test-e2e@lideresenseguros.com',
      phone: '60000000',
      concept: 'E2E Smoke Test - AuthCapture',
      description: 'Prueba E2E recurrencia PagueloFacil',
    };

    const cardInfo = {
      cardNumber: '5517747952039692', // PF sandbox test card (Mastercard)
      expMonth: '1',
      expYear: '30',
      cvv: '123',
      firstName: 'Test',
      lastName: 'E2E',
      cardType: 'MASTERCARD',
    };

    console.log('[PF-E2E] Step 1: AuthCapture $' + chargeAmount + ' with sandbox test card...');
    const authRes = await pf.AuthCapture(paymentInfo, cardInfo);

    results.step1_authCapture = {
      success: authRes?.success,
      headerCode: authRes?.headerStatus?.code,
      headerDesc: authRes?.headerStatus?.description,
      codOper: authRes?.data?.codOper,
      status: authRes?.data?.status,
      operationType: authRes?.data?.operationType,
      totalPay: authRes?.data?.totalPay,
      displayNum: authRes?.data?.displayNum,
      messageSys: authRes?.data?.messageSys,
    };

    if (!authRes?.success || authRes?.headerStatus?.code !== 200 || authRes?.data?.status !== 1) {
      results.summary = `❌ Step 1 FAILED — AuthCapture not approved. code=${authRes?.headerStatus?.code}, status=${authRes?.data?.status}, msg=${authRes?.data?.messageSys || authRes?.message}`;
      console.error('[PF-E2E]', results.summary);
      return NextResponse.json(results, { status: 400 });
    }

    const authCodOper = authRes.data.codOper;
    console.log('[PF-E2E] ✅ Step 1 OK — AuthCapture approved, codOper:', authCodOper);

    // ═══ STEP 2: Register Recurrent with the codOper from step 1 ═══
    const recurrentInfo = {
      amount: chargeAmount,
      taxAmount: 0.0,
      email: 'test-e2e@lideresenseguros.com',
      phone: '60000000',
      concept: 'E2E Smoke Test - Recurrent',
      description: 'Prueba E2E recurrencia mensual',
      codOper: authCodOper,
    };

    console.log('[PF-E2E] Step 2: Registering RECURRENT with codOper:', authCodOper);
    const recRes = await pf.Recurrent(recurrentInfo);

    results.step2_recurrent = {
      success: recRes?.success,
      headerCode: recRes?.headerStatus?.code,
      headerDesc: recRes?.headerStatus?.description,
      codOper: recRes?.data?.codOper,
      status: recRes?.data?.status,
      operationType: recRes?.data?.operationType,
      totalPay: recRes?.data?.totalPay,
      messageSys: recRes?.data?.messageSys,
    };

    if (!recRes?.success || recRes?.headerStatus?.code !== 200) {
      results.summary = `❌ Step 2 FAILED — Recurrent registration failed. code=${recRes?.headerStatus?.code}, msg=${recRes?.data?.messageSys || recRes?.message}`;
      console.error('[PF-E2E]', results.summary);
      return NextResponse.json(results, { status: 400 });
    }

    // Check if recurrence status is approved
    if (recRes?.data?.status !== undefined && recRes.data.status !== 1) {
      results.summary = `⚠️ Step 2 PARTIAL — Recurrent registered but status=${recRes.data.status} (not approved). codOper=${recRes.data.codOper}, msg=${recRes.data.messageSys}`;
      console.warn('[PF-E2E]', results.summary);
      return NextResponse.json(results, { status: 200 });
    }

    const recCodOper = recRes.data?.codOper || authCodOper;
    console.log('[PF-E2E] ✅ Step 2 OK — Recurrent registered, codOper:', recCodOper);

    results.summary = `✅ E2E PASSED — AuthCapture(${authCodOper}) → Recurrent(${recCodOper}) both approved`;

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('[PF-E2E] Exception:', error);
    results.summary = `💥 EXCEPTION: ${error.message}`;
    return NextResponse.json(results, { status: 500 });
  }
}
