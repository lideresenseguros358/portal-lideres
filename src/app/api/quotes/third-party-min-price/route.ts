/**
 * API Route: Obtener precio mínimo de Daños a Terceros (DINÁMICO)
 * Consulta tabla de BD actualizada automáticamente por cotizaciones reales
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Consultar precios de la tabla actualizada por cotizaciones reales
    const { data: prices, error } = await supabase
      .from('third_party_min_prices')
      .select('insurer_name, min_price, last_updated_at')
      .eq('policy_type', 'DANOS_TERCEROS')
      .order('min_price', { ascending: true });

    if (error) {
      console.error('[Min Price] Error consultando BD:', error);
      throw error;
    }

    if (!prices || prices.length === 0) {
      // Fallback si no hay datos en BD
      return NextResponse.json({
        success: true,
        minPrice: 130,
        insurer: 'FEDPA',
        plan: 'Daños a Terceros',
        note: 'Precio de referencia inicial',
      });
    }

    // El primer elemento es el más económico (order by min_price ASC)
    const minPriceData = prices[0];

    // Validación adicional de seguridad
    if (!minPriceData) {
      return NextResponse.json({
        success: true,
        minPrice: 130,
        insurer: 'FEDPA',
        plan: 'Daños a Terceros',
        note: 'Precio de referencia inicial',
      });
    }

    console.log('[Min Price] Precio desde BD:', {
      insurer: minPriceData.insurer_name,
      price: minPriceData.min_price,
      lastUpdated: minPriceData.last_updated_at,
    });

    return NextResponse.json({
      success: true,
      minPrice: parseFloat(minPriceData.min_price),
      insurer: minPriceData.insurer_name,
      plan: 'Daños a Terceros',
      lastUpdated: minPriceData.last_updated_at,
      allPrices: prices.map(p => ({
        insurer: p.insurer_name,
        price: parseFloat(p.min_price),
      })),
    });

  } catch (error) {
    console.error('[Min Price] Error general:', error);
    
    // Fallback en caso de error
    return NextResponse.json({
      success: true,
      minPrice: 130,
      insurer: 'FEDPA',
      plan: 'Daños a Terceros',
      note: 'Precio de referencia (error en consulta)',
    });
  }
}
