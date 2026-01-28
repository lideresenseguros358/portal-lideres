/**
 * Endpoint para cargar catálogos iniciales en BD local
 * GET /api/is/load-catalogs
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const MARCAS_INICIALES = [
  { vcodmarca: '156', vdescripcion: 'TOYOTA' },
  { vcodmarca: '74', vdescripcion: 'HONDA' },
  { vcodmarca: '99', vdescripcion: 'NISSAN' },
  { vcodmarca: '75', vdescripcion: 'HYUNDAI' },
  { vcodmarca: '53', vdescripcion: 'FORD' },
  { vcodmarca: '24', vdescripcion: 'CHEVROLET' },
  { vcodmarca: '98', vdescripcion: 'MITSUBISHI' },
  { vcodmarca: '92', vdescripcion: 'MAZDA' },
  { vcodmarca: '80', vdescripcion: 'KIA' },
  { vcodmarca: '154', vdescripcion: 'SUZUKI' },
  { vcodmarca: '42', vdescripcion: 'DODGE' },
  { vcodmarca: '79', vdescripcion: 'JEEP' },
  { vcodmarca: '97', vdescripcion: 'MERCEDES-BENZ' },
  { vcodmarca: '8', vdescripcion: 'BMW' },
  { vcodmarca: '5', vdescripcion: 'AUDI' },
  { vcodmarca: '159', vdescripcion: 'VOLKSWAGEN' },
  { vcodmarca: '129', vdescripcion: 'SUBARU' },
  { vcodmarca: '89', vdescripcion: 'LEXUS' },
  { vcodmarca: '52', vdescripcion: 'FIAT' },
  { vcodmarca: '115', vdescripcion: 'RENAULT' },
];

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Verificar si ya existen marcas
    const { data: existing } = await supabase
      .from('is_catalogs')
      .select('catalog_type')
      .eq('catalog_type', 'marcas')
      .eq('environment', 'development')
      .single();
    
    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Los catálogos ya existen',
        action: 'none',
      });
    }
    
    // Cargar marcas iniciales
    const { error: marcasError } = await supabase
      .from('is_catalogs')
      .upsert({
        catalog_type: 'marcas',
        catalog_data: MARCAS_INICIALES as any,
        environment: 'development',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'catalog_type,environment',
      });
    
    if (marcasError) {
      console.error('Error cargando marcas:', marcasError);
      return NextResponse.json({
        success: false,
        error: 'Error cargando marcas',
        details: marcasError.message,
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Catálogo cargado: ${MARCAS_INICIALES.length} marcas`,
      action: 'loaded',
      marcas: MARCAS_INICIALES.length,
    });
    
  } catch (error: any) {
    console.error('Error en load-catalogs:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
