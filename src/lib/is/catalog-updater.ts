/**
 * Sistema de auto-actualización de catálogos en background
 * Se ejecuta cuando se llaman APIs de cotización
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';

const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas
const lastUpdateCheck: Map<string, number> = new Map();

/**
 * Verificar si necesita actualización y ejecutar en background
 * No bloquea - retorna inmediatamente
 */
export async function checkAndUpdateCatalogs(source: 'IS' | 'FEDPA' = 'IS') {
  const key = `${source}_last_check`;
  const lastCheck = lastUpdateCheck.get(key) || 0;
  const now = Date.now();
  
  // Si ya revisamos en las últimas 24 horas, no hacer nada
  if (now - lastCheck < UPDATE_INTERVAL) {
    return;
  }
  
  lastUpdateCheck.set(key, now);
  
  // Verificar en BD si necesita actualización
  const supabase = getSupabaseAdmin();
  const { data: catalog } = await supabase
    .from('is_catalogs')
    .select('updated_at')
    .eq('catalog_type', 'marcas')
    .eq('environment', 'development')
    .single();
  
  if (catalog) {
    const age = now - new Date(catalog.updated_at).getTime();
    
    // Si tiene menos de 24 horas, no actualizar
    if (age < UPDATE_INTERVAL) {
      console.log(`[Catalog Updater] Cache válido (${Math.round(age / 1000 / 60 / 60)}h)`);
      return;
    }
  }
  
  // Actualizar en background (no esperar)
  console.log('[Catalog Updater] 🔄 Iniciando actualización en background...');
  updateCatalogsInBackground(source);
}

/**
 * Actualizar catálogos en background sin bloquear
 */
async function updateCatalogsInBackground(source: 'IS' | 'FEDPA') {
  try {
    // Llamar al endpoint de sync sin esperar respuesta
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    fetch(`${baseUrl}/api/is/sync-catalogs?type=all`, {
      method: 'GET',
      signal: AbortSignal.timeout(5 * 60 * 1000), // 5 minutos timeout
    })
      .then(res => res.json())
      .then(data => {
        console.log('[Catalog Updater] ✅ Actualización completada:', data);
      })
      .catch(err => {
        console.error('[Catalog Updater] ❌ Error en actualización:', err.message);
      });
    
  } catch (error) {
    console.error('[Catalog Updater] Error:', error);
  }
}

/**
 * Trigger para llamar cuando se use API de cotización
 * Agregar en servicios de cotización de IS/FEDPA
 */
export function triggerCatalogUpdate(source: 'IS' | 'FEDPA') {
  // No espera - ejecuta en background
  checkAndUpdateCatalogs(source).catch(() => {});
}
