/**
 * DIAGNOSTICS ENDPOINT - Environment Variables Check
 * ===================================================
 * Verifica que todas las variables requeridas estén configuradas
 * NO retorna valores, solo true/false por seguridad
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Verificar autorización
  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = authHeader?.replace('Bearer ', '') || xCronSecret;

  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Variables requeridas por categoría
  const requiredVars = {
    auth: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
    imap: [
      'ZOHO_IMAP_HOST',
      'ZOHO_IMAP_PORT',
      'ZOHO_IMAP_USER',
      'ZOHO_IMAP_PASS',
      'FEATURE_ENABLE_IMAP',
    ],
    smtp: [
      'ZEPTO_SMTP_HOST',
      'ZEPTO_SMTP_PORT',
      'ZEPTO_SMTP_USER',
      'ZEPTO_SMTP_PASS',
    ],
    vertex: [
      'GOOGLE_CLOUD_PROJECT',
      'GOOGLE_CLOUD_LOCATION',
      'GOOGLE_APPLICATION_CREDENTIALS',
      'FEATURE_ENABLE_VERTEX',
    ],
    cron: [
      'CRON_SECRET',
    ],
  };

  // Verificar presencia de cada variable
  const results: Record<string, any> = {};
  let allOk = true;
  const missingKeys: string[] = [];

  for (const [category, vars] of Object.entries(requiredVars)) {
    const categoryResults: Record<string, boolean> = {};
    
    for (const varName of vars) {
      const exists = !!process.env[varName];
      categoryResults[varName] = exists;
      
      if (!exists) {
        allOk = false;
        missingKeys.push(varName);
      }
    }
    
    results[category] = categoryResults;
  }

  // Valores especiales (NO sensibles)
  const config = {
    imapEnabled: process.env.FEATURE_ENABLE_IMAP === 'true',
    vertexEnabled: process.env.FEATURE_ENABLE_VERTEX === 'true',
    imapPollWindow: process.env.IMAP_POLL_WINDOW_MINUTES || '60',
    imapMaxMessages: process.env.IMAP_MAX_MESSAGES_PER_RUN || '20',
  };

  return NextResponse.json({
    success: allOk,
    timestamp: new Date().toISOString(),
    results,
    config,
    missingKeys: missingKeys.length > 0 ? missingKeys : undefined,
    summary: allOk 
      ? '✅ Todas las variables requeridas están configuradas'
      : `❌ Faltan ${missingKeys.length} variables: ${missingKeys.join(', ')}`,
  });
}
