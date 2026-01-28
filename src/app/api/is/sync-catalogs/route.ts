/**
 * Endpoint para sincronizar catálogos completos desde IS API
 * GET /api/is/sync-catalogs?type=marcas|modelos|all
 * 
 * Carga todos los datos desde API externa y los guarda en BD local
 * Solo debe ejecutarse una vez o cuando se requiera actualización
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isGet } from '@/lib/is/http-client';
import { IS_ENDPOINTS } from '@/lib/is/config';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'all';
  
  const results: any = {
    success: true,
    synced: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };
  
  try {
    const supabase = getSupabaseAdmin();
    
    // Sincronizar marcas
    if (type === 'marcas' || type === 'all') {
      console.log('[Sync] Cargando marcas desde IS API...');
      const marcasResponse = await isGet<any>(IS_ENDPOINTS.MARCAS, 'development');
      
      if (marcasResponse.success && marcasResponse.data) {
        let marcas = Array.isArray(marcasResponse.data) 
          ? marcasResponse.data 
          : marcasResponse.data.Table || [];
        
        // Mapear campos
        marcas = marcas.map((m: any) => ({
          vcodmarca: String(m.COD_MARCA || m.vcodmarca || ''),
          vdescripcion: m.TXT_DESC || m.vdescripcion || '',
        }));
        
        await supabase.from('is_catalogs').upsert({
          catalog_type: 'marcas',
          catalog_data: marcas as any,
          environment: 'development',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'catalog_type,environment' });
        
        results.synced.push({ type: 'marcas', count: marcas.length });
        console.log(`[Sync] ✅ Marcas: ${marcas.length}`);
      } else {
        results.errors.push({ type: 'marcas', error: marcasResponse.error });
      }
    }
    
    // Sincronizar modelos
    if (type === 'modelos' || type === 'all') {
      console.log('[Sync] Cargando TODOS los modelos desde IS API...');
      const modelosResponse = await isGet<any>('/api/cotizaemisorauto/getmodelos/1/20000', 'development');
      
      if (modelosResponse.success && modelosResponse.data) {
        let rawModelos = Array.isArray(modelosResponse.data)
          ? modelosResponse.data
          : modelosResponse.data.Table || [];
        
        // Mapear campos
        const modelos = rawModelos.map((m: any) => ({
          vcodmodelo: String(m.COD_MODELO || m.vcodmodelo || ''),
          vdescripcion: m.TXT_DESC || m.vdescripcion || '',
          vcodmarca: String(m.COD_MARCA || m.vcodmarca || ''),
        }));
        
        await supabase.from('is_catalogs').upsert({
          catalog_type: 'modelos',
          catalog_data: modelos as any,
          environment: 'development',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'catalog_type,environment' });
        
        results.synced.push({ type: 'modelos', count: modelos.length });
        console.log(`[Sync] ✅ Modelos: ${modelos.length}`);
      } else {
        results.errors.push({ type: 'modelos', error: modelosResponse.error });
      }
    }
    
    return NextResponse.json(results);
    
  } catch (error: any) {
    console.error('[Sync] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// Función para sincronizar en background (no bloquea respuesta)
export async function syncInBackground(type: 'marcas' | 'modelos' | 'all' = 'all') {
  fetch(`http://localhost:3000/api/is/sync-catalogs?type=${type}`, {
    method: 'GET',
  }).catch(err => console.error('[Background Sync] Error:', err));
}
