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
    // Recopilar precios de todas las aseguradoras
    const allPrices: { insurer: string; price: number; source: string }[] = [];

    // 1. Precios estáticos de las constantes (siempre disponibles)
    for (const insurer of AUTO_THIRD_PARTY_INSURERS) {
      const cheapest = Math.min(insurer.basicPlan.annualPremium, insurer.premiumPlan.annualPremium);
      allPrices.push({
        insurer: insurer.name,
        price: cheapest,
        source: 'static',
      });
    }

    // 2. Intentar obtener precios reales de FEDPA desde la API interna
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      const fedpaRes = await fetch(`${baseUrl}/api/fedpa/third-party`, {
        next: { revalidate: 3600 },
      });

      if (fedpaRes.ok) {
        const fedpaData = await fedpaRes.json();
        if (fedpaData.success && fedpaData.plans?.length > 0) {
          const fedpaPrices = fedpaData.plans.map((p: any) => p.annualPremium as number);
          const fedpaMin = Math.min(...fedpaPrices);

          // Reemplazar precio estático de FEDPA con el real
          const fedpaIdx = allPrices.findIndex(p => p.insurer.toUpperCase().includes('FEDPA'));
          if (fedpaIdx >= 0) {
            allPrices[fedpaIdx] = { insurer: 'FEDPA Seguros', price: fedpaMin, source: 'api' };
          } else {
            allPrices.push({ insurer: 'FEDPA Seguros', price: fedpaMin, source: 'api' });
          }
        }
      }
    } catch (e) {
      console.warn('[Min Price] No se pudo obtener precio real de FEDPA, usando estático');
    }

    // Ordenar por precio ascendente
    allPrices.sort((a, b) => a.price - b.price);

    const cheapest = allPrices[0] || { insurer: 'Referencia', price: 130, source: 'fallback' };

    return NextResponse.json({
      success: true,
      minPrice: Math.round(cheapest.price),
      insurer: cheapest.insurer,
      source: cheapest.source,
      plan: 'Daños a Terceros',
      allPrices: allPrices.map(p => ({
        insurer: p.insurer,
        price: Math.round(p.price),
        source: p.source,
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
