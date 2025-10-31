/**
 * Página de Comparación de Cotizaciones
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';
import QuoteComparison from '@/components/cotizadores/QuoteComparison';

/**
 * Genera cotización REAL con INTERNACIONAL usando las APIs
 */
const generateInternacionalRealQuote = async (quoteData: any) => {
  try {
    // Usar códigos numéricos que vienen del formulario
    // Si no vienen (formulario viejo), usar defaults
    const vcodmarca = quoteData.marcaCodigo || 204; // Default Toyota si no viene
    const vcodmodelo = quoteData.modeloCodigo || 1234; // Default Corolla si no viene
    const vcodplancobertura = 14; // Plan 14 = Cobertura Completa Comercial
    const vcodgrupotarifa = 1; // Grupo tarifa standard
    
    console.log('[INTERNACIONAL] Usando códigos:', {
      marca: `${quoteData.marca} (${vcodmarca})`,
      modelo: `${quoteData.modelo} (${vcodmodelo})`,
      plan: vcodplancobertura,
      grupo: vcodgrupotarifa,
    });
    
    // Llamar API para generar cotización
    const quoteResponse = await fetch('/api/is/auto/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vcodtipodoc: 1, // 1=CC (Cédula), 2=RUC, 3=PAS (Pasaporte) - DEBE SER NÚMERO
        vnrodoc: quoteData.cedula || '8-999-9999',
        vnombre: quoteData.nombreCompleto?.split(' ')[0] || 'Cliente',
        vapellido: quoteData.nombreCompleto?.split(' ').slice(1).join(' ') || 'Potencial',
        vtelefono: quoteData.telefono || '6000-0000',
        vcorreo: quoteData.email || 'cliente@example.com',
        vcodmarca,
        vcodmodelo,
        vanioauto: quoteData.anio || new Date().getFullYear(),
        vsumaaseg: quoteData.valorVehiculo || 15000,
        vcodplancobertura,
        vcodgrupotarifa,
        environment: 'development',
      }),
    });
    
    if (!quoteResponse.ok) {
      console.error('Error en API quote:', await quoteResponse.text());
      return null;
    }
    
    const quoteResult = await quoteResponse.json();
    if (!quoteResult.success || !quoteResult.idCotizacion) {
      console.error('No se obtuvo ID de cotización');
      return null;
    }
    
    const idCotizacion = quoteResult.idCotizacion;
    console.log('[INTERNACIONAL] ID Cotización:', idCotizacion);
    
    // Obtener coberturas y precio real
    const coberturasResponse = await fetch(`/api/is/auto/coberturas?vIdPv=${idCotizacion}&env=development`);
    
    if (!coberturasResponse.ok) {
      console.error('Error en API coberturas:', await coberturasResponse.text());
      return null;
    }
    
    const coberturasResult = await coberturasResponse.json();
    if (!coberturasResult.success) {
      console.error('No se obtuvieron coberturas');
      return null;
    }
    
    const coberturas = coberturasResult.data?.coberturas || [];
    const primaTotal = coberturasResult.data?.total || coberturasResult.data?.primaTotal || 1200;
    
    console.log('[INTERNACIONAL] Prima Total REAL:', primaTotal);
    console.log('[INTERNACIONAL] Coberturas:', coberturas.length);
    
    // Retornar en formato compatible con QuoteComparison
    return {
      id: 'internacional-real',
      insurerName: 'INTERNACIONAL de Seguros',
      planType: 'premium' as const,
      isRecommended: true,
      annualPremium: primaTotal,
      deductible: 250,
      coverages: coberturas.map((c: any) => ({
        name: c.descripcion || c.nombre,
        included: true,
      })),
      // Datos adicionales para emisión
      _isReal: true,
      _idCotizacion: idCotizacion,
      _vcodmarca: vcodmarca,
      _vcodmodelo: vcodmodelo,
      _vcodplancobertura: vcodplancobertura,
      _vcodgrupotarifa: vcodgrupotarifa,
      // También guardar nombres para el resumen
      _marcaNombre: quoteData.marca,
      _modeloNombre: quoteData.modelo,
    };
  } catch (error) {
    console.error('[INTERNACIONAL] Error generando cotización real:', error);
    return null;
  }
};

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
    const loadQuoteData = async () => {
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
        
        const policyType = input.cobertura === 'COMPLETA' ? 'auto-completa' : input.policyType;
        
        // Generar cotizaciones mock (las otras 4 aseguradoras)
        const mockQuotes = generateMockQuotes(policyType, input);
        
        // Si es Auto Cobertura Completa, intentar obtener cotización REAL de INTERNACIONAL
        if (policyType === 'auto-completa') {
          try {
            const internacionalQuote = await generateInternacionalRealQuote(input);
            if (internacionalQuote) {
              // Reemplazar la cotización mock de INTERNACIONAL con la real
              const quotesWithReal = mockQuotes.filter(q => !q.insurerName.includes('INTERNACIONAL'));
              quotesWithReal.unshift(internacionalQuote); // INTERNACIONAL primero
              setQuotes(quotesWithReal);
            } else {
              // Si falla, usar mock
              setQuotes(mockQuotes);
            }
          } catch (error) {
            console.error('Error obteniendo cotización INTERNACIONAL:', error);
            toast.warning('Usando cotización estimada para INTERNACIONAL');
            setQuotes(mockQuotes);
          }
        } else {
          setQuotes(mockQuotes);
        }
        
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
