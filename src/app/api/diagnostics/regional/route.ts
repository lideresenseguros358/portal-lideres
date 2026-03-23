/**
 * DIAGNOSTIC: Regional API Config & Connectivity Check
 * GET /api/diagnostics/regional
 *
 * Checks environment, credentials (masked), and tests a simple catalog call.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRegionalEnv, getRegionalBaseUrl, getRegionalCredentials, REGIONAL_RC_ENDPOINTS } from '@/lib/regional/config';
import { regionalGet } from '@/lib/regional/http-client';
import { requireCronSecret } from '@/lib/security/api-guard';

export async function GET(request: NextRequest) {
  const authErr = requireCronSecret(request);
  if (authErr) return authErr;
  const env = getRegionalEnv();
  const baseUrl = getRegionalBaseUrl();
  const creds = getRegionalCredentials();

  // Mask sensitive values
  const mask = (s: string) => s ? `${s.substring(0, 4)}...${s.substring(s.length - 4)}` : '(empty)';

  const config = {
    REGIONAL_ENV_explicit: process.env.REGIONAL_ENV || '(not set)',
    NODE_ENV: process.env.NODE_ENV || '(not set)',
    resolvedEnv: env,
    baseUrl,
    // PROD vars
    REGIONAL_BASE_URL_PROD: process.env.REGIONAL_BASE_URL_PROD ? '✅ SET' : '❌ NOT SET',
    REGIONAL_USERNAME_PROD: process.env.REGIONAL_USERNAME_PROD || '❌ NOT SET',
    REGIONAL_PASSWORD_PROD: process.env.REGIONAL_PASSWORD_PROD ? `✅ SET (${mask(process.env.REGIONAL_PASSWORD_PROD)})` : '❌ NOT SET',
    REGIONAL_TOKEN_PROD: process.env.REGIONAL_TOKEN_PROD ? `✅ SET (${mask(process.env.REGIONAL_TOKEN_PROD)})` : '❌ NOT SET',
    REGIONAL_COD_INTER_PROD: process.env.REGIONAL_COD_INTER_PROD || '❌ NOT SET',
    // DESA vars
    REGIONAL_BASE_URL_DESA: process.env.REGIONAL_BASE_URL_DESA ? '✅ SET' : '❌ NOT SET',
    REGIONAL_USERNAME_DESA: process.env.REGIONAL_USERNAME_DESA || '❌ NOT SET',
    REGIONAL_TOKEN_DESA: process.env.REGIONAL_TOKEN_DESA ? `✅ SET (${mask(process.env.REGIONAL_TOKEN_DESA)})` : '❌ NOT SET',
    // Legacy fallback
    REGIONAL_BASE_URL: process.env.REGIONAL_BASE_URL ? '✅ SET' : '(not set)',
    REGIONAL_TOKEN: process.env.REGIONAL_TOKEN ? '✅ SET' : '(not set)',
    // Resolved credentials being used
    resolvedCredentials: {
      username: creds.username,
      password: creds.password ? `✅ (${mask(creds.password)})` : '❌ EMPTY',
      codInter: creds.codInter,
      token: creds.token ? `✅ (${mask(creds.token)})` : '❌ EMPTY',
    },
  };

  // Test connectivity: hit planesRc (lightweight GET)
  let connectivity: any = { tested: false };
  try {
    const t0 = Date.now();
    const res = await regionalGet<any>(REGIONAL_RC_ENDPOINTS.PLANES);
    const elapsed = Date.now() - t0;

    connectivity = {
      tested: true,
      endpoint: REGIONAL_RC_ENDPOINTS.PLANES,
      fullUrl: `${baseUrl}${REGIONAL_RC_ENDPOINTS.PLANES}`,
      success: res.success,
      status: res.status,
      elapsedMs: elapsed,
      error: res.error || null,
      dataPreview: res.success ? JSON.stringify(res.data || res.raw).substring(0, 300) : null,
    };
  } catch (err: any) {
    connectivity = {
      tested: true,
      success: false,
      error: err.message,
    };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    config,
    connectivity,
  });
}
