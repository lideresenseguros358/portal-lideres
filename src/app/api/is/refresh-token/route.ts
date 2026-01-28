/**
 * Endpoint para renovar token diario de IS
 * GET /api/is/refresh-token
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { IS_CONFIG } from '@/lib/is/config';

export async function GET() {
  try {
    const config = IS_CONFIG['development'];
    const supabase = getSupabaseAdmin();
    
    console.log('[Token] Renovando token diario de IS...');
    console.log('[Token] URL:', `${config.baseUrl}/api/tokens`);
    console.log('[Token] Bearer presente:', config.bearerToken.substring(0, 20) + '...');
    
    const response = await fetch(`${config.baseUrl}/api/tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.bearerToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
    
    const responseText = await response.text();
    console.log('[Token] Status:', response.status);
    console.log('[Token] Response:', responseText.substring(0, 200));
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}`,
        details: responseText.substring(0, 500),
      }, { status: response.status });
    }
    
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Respuesta no es JSON válido',
        details: responseText.substring(0, 500),
      }, { status: 500 });
    }
    
    if (!data.token) {
      return NextResponse.json({
        success: false,
        error: 'Respuesta no contiene token',
        data,
      }, { status: 500 });
    }
    
    // Guardar token en BD
    const expiresAt = data.expiresAt 
      ? new Date(data.expiresAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const { error: dbError } = await supabase
      .from('is_daily_tokens')
      .upsert({
        environment: 'development',
        token: data.token,
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'environment' });
    
    if (dbError) {
      console.error('[Token] Error guardando en BD:', dbError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Token renovado exitosamente',
      expiresAt: expiresAt.toISOString(),
      tokenPreview: data.token.substring(0, 30) + '...',
    });
    
  } catch (error: any) {
    console.error('[Token] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
