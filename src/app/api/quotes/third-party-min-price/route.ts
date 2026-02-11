/**
 * API Route: Obtener precio mínimo de Daños a Terceros (DINÁMICO)
 * Calcula el precio más económico entre todas las aseguradoras de DT.
 * - Intenta obtener precios reales de FEDPA vía API
 * - Usa precios estáticos de Internacional y otras aseguradoras
 * - Retorna el mínimo global
 */

import { NextResponse } from 'next/server';
import { AUTO_THIRD_PARTY_INSURERS } from '@/lib/constants/auto-quotes';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Use fixed prices from constants (FEDPA $130, IS $154)
    const allPrices = AUTO_THIRD_PARTY_INSURERS.map(insurer => ({
      insurer: insurer.name,
      price: Math.min(insurer.basicPlan.annualPremium, insurer.premiumPlan.annualPremium),
    }));

    allPrices.sort((a, b) => a.price - b.price);
    const cheapest = allPrices[0] || { insurer: 'Referencia', price: 130 };

    return NextResponse.json({
      success: true,
      minPrice: Math.round(cheapest.price),
      insurer: cheapest.insurer,
      plan: 'Daños a Terceros',
      allPrices: allPrices.map(p => ({
        insurer: p.insurer,
        price: Math.round(p.price),
      })),
    });
  } catch (error) {
    console.error('[Min Price] Error general:', error);

    // Fallback absoluto: buscar el mínimo de las constantes
    let fallbackMin = 130;
    try {
      const prices = AUTO_THIRD_PARTY_INSURERS.flatMap(i => [
        i.basicPlan.annualPremium,
        i.premiumPlan.annualPremium,
      ]);
      fallbackMin = Math.round(Math.min(...prices));
    } catch { /* use 130 */ }

    return NextResponse.json({
      success: true,
      minPrice: fallbackMin,
      insurer: 'Referencia',
      plan: 'Daños a Terceros',
      note: 'Precio de referencia (fallback)',
    });
  }
}
