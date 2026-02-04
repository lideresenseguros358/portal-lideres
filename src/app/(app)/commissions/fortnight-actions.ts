'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Get fortnights by IDs with formatted labels
 */
export async function actionGetFortnightsByIds(fortnightIds: string[]) {
  try {
    console.log('[actionGetFortnightsByIds] ===== INICIO =====');
    console.log('[actionGetFortnightsByIds] IDs recibidos:', fortnightIds);
    
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('fortnights')
      .select('*')
      .in('id', fortnightIds);
    
    console.log('[actionGetFortnightsByIds] Query result - data:', data);
    console.log('[actionGetFortnightsByIds] Query result - error:', error);
    
    if (error) {
      console.error('[actionGetFortnightsByIds] Error en query:', error);
      return { ok: false as const, error: error.message };
    }
    
    if (!data || data.length === 0) {
      console.log('[actionGetFortnightsByIds] NO DATA - retornando array vacío');
      return { ok: true as const, data: [] };
    }
    
    // Formatear labels: "Q1 Noviembre 2025" 
    // Usar period_start directamente parseado en UTC
    console.log('[actionGetFortnightsByIds] Data completa:', JSON.stringify(data, null, 2));
    
    const formatted = data.map((f: any) => {
      // Parsear fecha en UTC para evitar problemas de timezone
      const parts = f.period_start.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      
      // Crear objeto de fecha en UTC
      const dateObj = new Date(Date.UTC(year, month - 1, day));
      
      // Obtener mes en español
      const monthName = dateObj.toLocaleDateString('es-ES', { month: 'long', timeZone: 'UTC' });
      const monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      
      // Determinar Q1 o Q2 según el día
      const quarter = day <= 15 ? 'Q1' : 'Q2';
      
      const label = `${quarter} ${monthCapitalized} ${year}`;
      console.log(`[actionGetFortnightsByIds] ${f.id} -> ${label} (${f.period_start})`);
      
      return {
        id: f.id,
        label
      };
    });
    
    // Ordenar por fecha descendente (más reciente primero)
    formatted.sort((a, b) => {
      const dateA = data.find(d => d.id === a.id)?.period_start || '';
      const dateB = data.find(d => d.id === b.id)?.period_start || '';
      return dateB.localeCompare(dateA);
    });
    
    console.log('[actionGetFortnightsByIds] ===== RETORNANDO', formatted.length, 'quincenas =====');
    console.log('[actionGetFortnightsByIds] Formatted data:', JSON.stringify(formatted, null, 2));
    
    return { ok: true as const, data: formatted };
  } catch (error) {
    console.error('[actionGetFortnightsByIds] Exception:', error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
