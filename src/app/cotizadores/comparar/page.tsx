/**
 * Página de Comparación de Cotizaciones
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';
import QuoteComparison from '@/components/cotizadores/QuoteComparison';

// Datos de prueba - 5 aseguradoras para auto, 2 para incendio/contenido
const generateMockQuotes = (policyType: string, quoteData: any) => {
  if (policyType === 'auto-completa') {
    // 5 aseguradoras con 2 planes cada una - Las mismas de daños a terceros
    const insurers = [
      { name: 'INTERNACIONAL de Seguros', basePremium: 1200 },
      { name: 'FEDPA Seguros', basePremium: 1150 },
      { name: 'MAPFRE Panamá', basePremium: 1180 },
      { name: 'ASSA Seguros', basePremium: 1100 },
      { name: 'ANCÓN Seguros', basePremium: 1250 },
    ];

    const quotes = [];
    for (const insurer of insurers) {
      // Plan Básico
      quotes.push({
        id: `${insurer.name.toLowerCase()}-basico`,
        insurerName: insurer.name,
        planType: 'basico' as const,
        annualPremium: insurer.basePremium,
        deductible: 500,
        coverages: [
          { name: 'Daños propios por colisión', included: true },
          { name: 'Responsabilidad civil', included: true },
          { name: 'Robo total', included: true },
          { name: 'Asistencia vial básica', included: true },
          { name: 'Cristales', included: false },
          { name: 'Grua especializada', included: false },
        ]
      });

      // Plan Premium
      quotes.push({
        id: `${insurer.name.toLowerCase()}-premium`,
        insurerName: insurer.name,
        planType: 'premium' as const,
        isRecommended: insurer.name === 'ASSA Seguros', // ASSA premium recomendado
        annualPremium: insurer.basePremium * 1.4,
        deductible: 250,
        coverages: [
          { name: 'Daños propios por colisión', included: true },
          { name: 'Responsabilidad civil', included: true },
          { name: 'Robo total y parcial', included: true },
          { name: 'Asistencia vial 24/7', included: true },
          { name: 'Cristales y luces', included: true },
          { name: 'Grua especializada ilimitada', included: true },
          { name: 'Auto de reemplazo', included: true },
          { name: 'Protección de accesorios', included: true },
        ]
      });
    }
    return quotes;
  } else if (policyType === 'incendio' || policyType === 'contenido') {
    // 2 aseguradoras: Ancón e Internacional
    return [
      {
        id: 'ancon-standard',
        insurerName: 'ANCÓN Seguros',
        planType: 'basico' as const,
        annualPremium: 450,
        deductible: 100,
        coverages: [
          { name: 'Incendio y rayo', included: true },
          { name: 'Daños por agua', included: true },
          { name: 'Robo', included: policyType === 'contenido' },
          { name: 'Responsabilidad civil', included: true },
        ]
      },
      {
        id: 'internacional-premium',
        insurerName: 'INTERNACIONAL de Seguros',
        planType: 'premium' as const,
        isRecommended: true,
        annualPremium: 520,
        deductible: 50,
        coverages: [
          { name: 'Incendio y rayo', included: true },
          { name: 'Daños por agua y humedad', included: true },
          { name: 'Robo y vandalismo', included: true },
          { name: 'Responsabilidad civil ampliada', included: true },
          { name: 'Desastres naturales', included: true },
          { name: 'Gastos de habitación temporal', included: policyType === 'incendio' },
        ]
      },
    ];
  }
  return [];
};

export default function ComparePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);

  useEffect(() => {
    const loadQuoteData = () => {
      try {
        setLoading(true);
        
        // Obtener datos del formulario
        const storedInput = sessionStorage.getItem('quoteInput');
        if (!storedInput) {
          router.push('/cotizadores');
          return;
        }

        const input = JSON.parse(storedInput);
        setQuoteData(input);
        
        // Generar cotizaciones mock
        const policyType = input.cobertura === 'COMPLETA' ? 'auto-completa' : input.policyType;
        const mockQuotes = generateMockQuotes(policyType, input);
        setQuotes(mockQuotes);
        
      } catch (err) {
        console.error('Error cargando cotizaciones:', err);
        router.push('/cotizadores');
      } finally {
        setLoading(false);
      }
    };

    loadQuoteData();
  }, [router]);

  if (loading) return <LoadingSkeleton />;
  if (!quoteData || quotes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700 mb-4">No hay cotizaciones disponibles</h2>
          <button
            onClick={() => router.push('/cotizadores')}
            className="px-6 py-3 bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white rounded-lg font-semibold"
          >
            Volver a Cotizar
          </button>
        </div>
      </div>
    );
  }

  const policyType = quoteData.cobertura === 'COMPLETA' ? 'auto-completa' : quoteData.policyType;

  return (
    <QuoteComparison
      policyType={policyType}
      quotes={quotes}
      quoteData={quoteData}
    />
  );
}
