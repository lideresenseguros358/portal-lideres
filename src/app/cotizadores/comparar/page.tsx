/**
 * Página de Comparación de Cotizaciones
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FaCar, FaCompressArrowsAlt } from 'react-icons/fa';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';
import QuoteComparison from '@/components/cotizadores/QuoteComparison';
import Breadcrumb from '@/components/ui/Breadcrumb';

/**
 * Mapeo de deducibles del formulario a vIdOpt de INTERNACIONAL
 * Bajo = 500 (básico) -> vIdOpt: 1
 * Medio = 250 (medio) -> vIdOpt: 2  
 * Alto = 100 (premium) -> vIdOpt: 3
 */
const mapDeductibleToVIdOpt = (deductible: string): 1 | 2 | 3 => {
  switch (deductible) {
    case 'bajo': return 1;  // Deducible alto = cobertura básica
    case 'medio': return 2; // Deducible medio = cobertura media
    case 'alto': return 3;  // Deducible bajo = cobertura premium
    default: return 1;
  }
};

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
    const vIdOpt = mapDeductibleToVIdOpt(quoteData.deducible || 'bajo'); // Mapear deducible
    
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
    
    // Obtener coberturas y precio real con vIdOpt según deducible
    const coberturasResponse = await fetch(`/api/is/auto/coberturas?vIdPv=${idCotizacion}&vIdOpt=${vIdOpt}&env=development`);
    
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
    console.log('[INTERNACIONAL] Deducible seleccionado:', quoteData.deducible, '-> vIdOpt:', vIdOpt);
    
    // Mapear deducible a valor numérico
    const deductibleValue = quoteData.deducible === 'alto' ? 100 : quoteData.deducible === 'medio' ? 250 : 500;
    
    // Retornar en formato compatible con QuoteComparison
    return {
      id: 'internacional-real',
      insurerName: 'INTERNACIONAL de Seguros',
      planType: vIdOpt === 3 ? 'premium' as const : 'basico' as const,
      isRecommended: true,
      annualPremium: primaTotal,
      deductible: deductibleValue,
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
      _vIdOpt: vIdOpt,
      _deducibleOriginal: quoteData.deducible,
      // También guardar nombres para el resumen
      _marcaNombre: quoteData.marca,
      _modeloNombre: quoteData.modelo,
    };
  } catch (error) {
    console.error('[INTERNACIONAL] Error generando cotización real:', error);
    return null;
  }
};

/**
 * Genera cotización REAL con FEDPA usando las APIs
 */
const generateFedpaRealQuote = async (quoteData: any) => {
  try {
    // Mapear deducible del formulario a EndosoIncluido
    // Bajo (500) = sin endoso (N), Medio (250) = con algunos endosos, Alto (100) = con todos los endosos (S)
    const endosoIncluido = quoteData.deducible === 'alto' ? 'S' : 'N';
    const deductibleValue = quoteData.deducible === 'alto' ? 100 : quoteData.deducible === 'medio' ? 250 : 500;
    
    console.log('[FEDPA] Generando cotización real...');
    console.log('[FEDPA] Deducible seleccionado:', quoteData.deducible, '-> EndosoIncluido:', endosoIncluido);
    
    // Llamar API FEDPA para cotización
    const cotizacionResponse = await fetch('/api/fedpa/cotizacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Ano: quoteData.anio || new Date().getFullYear(),
        Uso: '10', // Uso particular
        CantidadPasajeros: 5,
        SumaAsegurada: quoteData.valorVehiculo || 15000,
        CodLimiteLesiones: '1',
        CodLimitePropiedad: '1',
        CodLimiteGastosMedico: '1',
        EndosoIncluido: endosoIncluido,
        CodPlan: '411', // Plan 411 = Cobertura Completa Particular
        CodMarca: quoteData.marcaCodigo || 'TOY',
        CodModelo: quoteData.modeloCodigo || 'COROLLA',
        Nombre: quoteData.nombreCompleto?.split(' ')[0] || 'Cliente',
        Apellido: quoteData.nombreCompleto?.split(' ').slice(1).join(' ') || 'Potencial',
        Cedula: quoteData.cedula || '8-999-9999',
        Telefono: quoteData.telefono || '6000-0000',
        Email: quoteData.email || 'cliente@example.com',
        environment: 'PROD',
      }),
    });
    
    if (!cotizacionResponse.ok) {
      console.error('[FEDPA] Error en API:', await cotizacionResponse.text());
      return null;
    }
    
    const cotizacionResult = await cotizacionResponse.json();
    if (!cotizacionResult.success) {
      console.error('[FEDPA] No se obtuvo cotización válida');
      return null;
    }
    
    console.log('[FEDPA] Prima Total REAL:', cotizacionResult.primaTotal);
    console.log('[FEDPA] Coberturas:', cotizacionResult.coberturas?.length || 0);
    
    // Retornar en formato compatible con QuoteComparison
    return {
      id: 'fedpa-real',
      insurerName: 'FEDPA Seguros',
      planType: endosoIncluido === 'S' ? 'premium' as const : 'basico' as const,
      isRecommended: false,
      annualPremium: cotizacionResult.primaTotal || 0,
      deductible: deductibleValue,
      coverages: (cotizacionResult.coberturas || []).map((c: any) => ({
        name: c.descripcion || 'Cobertura',
        included: true,
      })),
      // Datos adicionales
      _isReal: true,
      _idCotizacion: cotizacionResult.idCotizacion,
      _endosoIncluido: endosoIncluido,
      _deducibleOriginal: quoteData.deducible,
      _marcaNombre: quoteData.marca,
      _modeloNombre: quoteData.modelo,
    };
  } catch (error) {
    console.error('[FEDPA] Error generando cotización real:', error);
    return null;
  }
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
        
        // Solo procesar si es Auto Cobertura Completa
        if (policyType === 'auto-completa') {
          const realQuotes: any[] = [];
          
          // INTERNACIONAL: generar plan básico y premium
          try {
            // Plan Básico (vIdOpt: 1, deducible 500)
            const intBasico = await generateInternacionalRealQuote({ ...input, deducible: 'bajo' });
            if (intBasico) {
              intBasico.id = 'internacional-basico';
              realQuotes.push(intBasico);
            }
            
            // Plan Premium (vIdOpt: 3, deducible 100)
            const intPremium = await generateInternacionalRealQuote({ ...input, deducible: 'alto' });
            if (intPremium) {
              intPremium.id = 'internacional-premium';
              realQuotes.push(intPremium);
            }
          } catch (error) {
            console.error('Error obteniendo cotizaciones INTERNACIONAL:', error);
            toast.error('Error al obtener cotizaciones de INTERNACIONAL');
          }
          
          // FEDPA: generar plan básico y premium
          try {
            // Plan Básico (EndosoIncluido: N, deducible 500)
            const fedpaBasico = await generateFedpaRealQuote({ ...input, deducible: 'bajo' });
            if (fedpaBasico) {
              fedpaBasico.id = 'fedpa-basico';
              realQuotes.push(fedpaBasico);
            }
            
            // Plan Premium (EndosoIncluido: S, deducible 100)
            const fedpaPremium = await generateFedpaRealQuote({ ...input, deducible: 'alto' });
            if (fedpaPremium) {
              fedpaPremium.id = 'fedpa-premium';
              realQuotes.push(fedpaPremium);
            }
          } catch (error) {
            console.error('Error obteniendo cotizaciones FEDPA:', error);
            toast.error('Error al obtener cotizaciones de FEDPA');
          }
          
          if (realQuotes.length > 0) {
            setQuotes(realQuotes);
            toast.success(`${realQuotes.length} cotización(es) generada(s): INTERNACIONAL y FEDPA`);
          } else {
            toast.error('No se pudieron generar cotizaciones. Intenta nuevamente.');
          }
        } else {
          // Para otros tipos de póliza, mostrar mensaje
          toast.info('Las cotizaciones automáticas solo están disponibles para Auto Cobertura Completa');
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
            className="px-6 py-3 bg-[#010139] hover:bg-[#8AAA19] text-white rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Volver a Cotizar
          </button>
        </div>
      </div>
    );
  }

  const policyType = quoteData.cobertura === 'COMPLETA' ? 'auto-completa' : quoteData.policyType;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { label: 'Auto', href: '/cotizadores/auto' },
            { label: 'Cobertura Completa', href: '/cotizadores/auto/completa' },
            { label: 'Comparar Cotizaciones', icon: <FaCompressArrowsAlt /> },
          ]}
        />

        <QuoteComparison
          policyType={policyType}
          quotes={quotes}
          quoteData={quoteData}
        />
      </div>
    </div>
  );
}
