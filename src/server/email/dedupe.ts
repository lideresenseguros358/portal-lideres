/**
 * SISTEMA DE DEDUPLICACIÓN
 * =========================
 * Control de correos duplicados usando dedupe_key
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Verificar si un correo ya fue enviado
 */
export async function checkDedupe(dedupeKey: string): Promise<boolean> {
  if (!dedupeKey) return false;

  const { data, error } = await supabase
    .from('email_logs')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .eq('status', 'sent')
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[DEDUPE] Error verificando:', error);
    return false;
  }

  return !!data;
}

/**
 * Generar dedupe key automático
 */
export function generateDedupeKey(
  to: string,
  template: string,
  uniqueId?: string
): string {
  const base = `${to}-${template}`;
  if (uniqueId) {
    return `${base}-${uniqueId}`;
  }
  // Si no hay uniqueId, usar fecha del día (permite 1 envío por día)
  const today = new Date().toISOString().split('T')[0];
  return `${base}-${today}`;
}
