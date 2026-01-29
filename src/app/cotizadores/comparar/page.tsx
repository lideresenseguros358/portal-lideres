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
        environment: 'production', // Cambiar a production para pruebas
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
    const coberturasResponse = await fetch(`/api/is/auto/coberturas?vIdPv=${idCotizacion}&vIdOpt=${vIdOpt}&env=production`);
    
    if (!coberturasResponse.ok) {
      console.error('Error en API coberturas:', await coberturasResponse.text());
      return null;
    }
    
    const coberturasResult = await coberturasResponse.json();
    if (!coberturasResult.success) {
      console.error('No se obtuvieron coberturas');
      return null;
    }
    
    const apiCoberturas = coberturasResult.data?.Table || [];
    const primaTotal = apiCoberturas.reduce((sum: number, c: any) => sum + (parseFloat(c[`PRIMA${vIdOpt}`] || c.PRIMA || 0)), 0);
    
    console.log(`[IS] Opción ${vIdOpt}: ${apiCoberturas.length} coberturas, Prima: $${primaTotal.toFixed(2)}`);
    
    // OBTENER deducibles REALES: COMPRENSIVO (fijo) y COLISION (variable)
    const dedKey = `DEDUCIBLE${vIdOpt}`;
    
    // Buscar coberturas específicas por nombre
    const coberturaComprensivo = apiCoberturas.find((c: any) => 
      c.COBERTURA?.toUpperCase().includes('COMPRENSIVO')
    );
    const coberturaColision = apiCoberturas.find((c: any) => 
      c.COBERTURA?.toUpperCase().includes('COLISION') || 
      c.COBERTURA?.toUpperCase().includes('VUELCO')
    );
    
    const deducibleComprensivo = coberturaComprensivo?.[dedKey] || '';
    const deducibleColision = coberturaColision?.[dedKey] || '';
    
    // Mostrar ambos deducibles si existen
    const deducibleReal = (deducibleColision && deducibleComprensivo)
      ? `Colisión: ${deducibleColision} | Comprensivo: ${deducibleComprensivo}`
      : deducibleColision || deducibleComprensivo || 'Según póliza';
    
    const deducibleInfo = {
      valor: 0,
      tipo: quoteData.deducible || 'medio',
      descripcion: deducibleReal,
    };
    
    // Mapear coberturas con TODOS los detalles según documentación IS
    const coberturasDetalladas = apiCoberturas.map((c: any) => {
      const deducibleKey = `DEDUCIBLE${vIdOpt}`;
      return {
        codigo: c.COD_AMPARO,
        nombre: c.COBERTURA,
        descripcion: c.COBERTURA,
        limite: c.LIMITES || 'Incluido',
        prima: parseFloat(c[`PRIMA${vIdOpt}`] || c.PRIMA || 0),
        deducible: c[deducibleKey] || '',
        incluida: true
      };
    });
    
    // Extraer límites de responsabilidad civil de las coberturas
    const limites = [];
    const lesionesCobertura = apiCoberturas.find((c: any) => 
      c.COBERTURA?.toUpperCase().includes('LESIONES') || 
      c.COBERTURA?.toUpperCase().includes('CORPORALES')
    );
    if (lesionesCobertura) {
      limites.push({
        tipo: 'lesiones_corporales' as const,
        limitePorPersona: lesionesCobertura.LIMITES?.split('/')[0]?.trim() || '',
        limitePorAccidente: lesionesCobertura.LIMITES?.split('/')[1]?.trim() || '',
        descripcion: 'Lesiones Corporales'
      });
    }
    
    const propiedadCobertura = apiCoberturas.find((c: any) => 
      c.COBERTURA?.toUpperCase().includes('PROPIEDAD') || 
      c.COBERTURA?.toUpperCase().includes('DAÑOS')
    );
    if (propiedadCobertura) {
      limites.push({
        tipo: 'daños_propiedad' as const,
        limitePorPersona: propiedadCobertura.LIMITES || '',
        descripcion: 'Daños a la Propiedad'
      });
    }
    
    const medicosCobertura = apiCoberturas.find((c: any) => 
      c.COBERTURA?.toUpperCase().includes('MÉDICOS') || 
      c.COBERTURA?.toUpperCase().includes('MEDICOS')
    );
    if (medicosCobertura) {
      limites.push({
        tipo: 'gastos_medicos' as const,
        limitePorPersona: medicosCobertura.LIMITES?.split('/')[0]?.trim() || '',
        limitePorAccidente: medicosCobertura.LIMITES?.split('/')[1]?.trim() || '',
        descripcion: 'Gastos Médicos'
      });
    }
    
    // Determinar si es básico o premium según planType del input
    const esPremium = quoteData.planType === 'premium';
    
    // Extraer beneficios/endosos adicionales para plan premium
    const beneficiosPremium = esPremium ? [
      'Asistencia vial 24/7',
      'Vehículo de reemplazo',
      'Cobertura en Centroamérica',
      'Protección de accesorios'
    ] : [];
    
    const endososPremium = esPremium ? [
      'Endoso de Cobertura Ampliada',
      'Endoso de Protección Total'
    ] : [];
    
    // Retornar en formato compatible con QuoteComparison CON TODOS LOS DETALLES
    return {
      id: 'internacional-real',
      insurerName: 'INTERNACIONAL de Seguros',
      planType: esPremium ? 'premium' as const : 'basico' as const,
      isRecommended: esPremium,
      annualPremium: primaTotal,
      deductible: deducibleInfo.valor,
      coverages: coberturasDetalladas.map((c: any) => ({
        name: c.nombre,
        included: true,
      })),
      // DATOS COMPLETOS PARA VISUALIZACIÓN
      _coberturasDetalladas: coberturasDetalladas,
      _limites: limites,
      _beneficios: beneficiosPremium,
      _endosos: endososPremium,
      _deducibleInfo: deducibleInfo,
      _sumaAsegurada: quoteData.valorVehiculo || 0,
      _endosoIncluido: esPremium ? 'Endoso Premium' : 'Endoso Básico',
      // Datos adicionales para emisión
      _isReal: true,
      _idCotizacion: idCotizacion,
      _vcodmarca: vcodmarca,
      _vcodmodelo: vcodmodelo,
      _vcodplancobertura: vcodplancobertura,
      _vcodgrupotarifa: vcodgrupotarifa,
      _vIdOpt: vIdOpt,
      _deducibleOriginal: quoteData.deducible,
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
    // MAPEO DE DEDUCIBLE A OPCION FEDPA:
    // bajo = OPCION A (deducible bajo $300, prima alta $563) - cliente paga menos deducible
    // medio = OPCION B (deducible medio $450, prima media $533) - equilibrado
    // alto = OPCION C (deducible alto $608, prima baja $513) - cliente paga más deducible
    const opcionMap: Record<string, string> = {
      bajo: 'A',   // Deducible bajo (pagar poco)
      medio: 'B',  // Deducible medio
      alto: 'C'    // Deducible alto (pagar mucho)
    };
    
    const opcionSeleccionada = opcionMap[quoteData.deducible || 'medio'];
    // CRÍTICO: El endoso depende del PLAN TYPE, NO del deducible
    const endosoIncluido = quoteData.planType === 'premium' ? 'S' : 'N';
    
    console.log('[FEDPA] Deducible:', quoteData.deducible, '→ Opción:', opcionSeleccionada);
    
    // Llamar API FEDPA para cotización
    // IMPORTANTE: Ahora enviar mismos parámetros que IS - el normalizador los procesará
    const cotizacionResponse = await fetch('/api/fedpa/cotizacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Parámetros de IS (serán normalizados automáticamente)
        vcodtipodoc: 1,
        vnrodoc: quoteData.cedula || '8-999-9999',
        vnombre: quoteData.nombreCompleto?.split(' ')[0] || 'Cliente',
        vapellido: quoteData.nombreCompleto?.split(' ').slice(1).join(' ') || 'Potencial',
        vtelefono: quoteData.telefono || '6000-0000',
        vcorreo: quoteData.email || 'cliente@example.com',
        vcodmarca: quoteData.marcaCodigo || 156,
        vcodmodelo: quoteData.modeloCodigo || 2469,
        // NOMBRES de marca y modelo (para FEDPA)
        marca: quoteData.marca || 'TOYOTA',
        modelo: quoteData.modelo || 'COROLLA',
        vanioauto: quoteData.anio || new Date().getFullYear(),
        vsumaaseg: quoteData.valorVehiculo || 15000,
        vcodplancobertura: 14,
        vcodgrupotarifa: 1,
        // COBERTURAS del formulario
        lesionCorporalPersona: quoteData.lesionCorporalPersona || 10000,
        lesionCorporalAccidente: quoteData.lesionCorporalAccidente || 20000,
        danoPropiedad: quoteData.danoPropiedad || 10000,
        gastosMedicosPersona: quoteData.gastosMedicosPersona || 2000,
        gastosMedicosAccidente: quoteData.gastosMedicosAccidente || 10000,
        deducible: quoteData.deducible || 'medio',
        // Endosos
        EndosoIncluido: endosoIncluido,
        environment: 'DEV', // USAR DEV para pruebas
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
    
    // FILTRAR solo las coberturas de la OPCION seleccionada
    const todasLasCoberturas = cotizacionResult.coberturas || [];
    const apiCoberturas = todasLasCoberturas.filter((c: any) => c.OPCION === opcionSeleccionada);
    
    if (apiCoberturas.length === 0) {
      console.error('[FEDPA] No se encontraron coberturas para opción:', opcionSeleccionada);
      return null;
    }
    
    const primaTotal = apiCoberturas[0]?.TOTAL_PRIMA_IMPUESTO || 0;
    
    console.log(`[FEDPA] Opción ${opcionSeleccionada}: ${apiCoberturas.length} coberturas, Prima: $${primaTotal}`);
    
    // OBTENER deducibles REALES: COMPRENSIVO (fijo) y COLISION (variable)
    const coberturaComprensivo = apiCoberturas.find((c: any) => c.COBERTURA === 'D');
    const coberturaColision = apiCoberturas.find((c: any) => c.COBERTURA === 'E');
    
    const deducibleComprensivo = coberturaComprensivo?.DEDUCIBLE || 0;
    const deducibleColision = coberturaColision?.DEDUCIBLE || 0;
    
    // Mostrar el deducible de COLISION (el que varía)
    const deducibleValor = deducibleColision;
    const deducibleReal = deducibleColision > 0 
      ? `Colisión: $${deducibleColision.toFixed(2)} | Comprensivo: $${deducibleComprensivo.toFixed(2)}`
      : 'Según póliza';
    
    const deducibleInfo = {
      valor: deducibleValor,
      tipo: quoteData.deducible || 'medio',
      descripcion: deducibleReal,
    };
    
    // Mapear coberturas (solo de la opción seleccionada)
    const coberturasDetalladas = apiCoberturas.map((c: any) => ({
      codigo: c.COBERTURA || '',
      nombre: c.DESCCOBERTURA || '',
      descripcion: c.DESCCOBERTURA || '',
      limite: c.LIMITE || 'Incluido',
      prima: parseFloat(c.PRIMA || 0),
      deducible: c.DEDUCIBLE ? `$${c.DEDUCIBLE.toFixed(2)}` : '',
      incluida: true
    }));
    
    // Extraer límites de responsabilidad civil (campos FEDPA en MAYÚSCULAS)
    const limites = [];
    const lesionesCobertura = apiCoberturas.find((c: any) => 
      (c.DESCCOBERTURA?.toUpperCase().includes('LESIONES') || 
       c.DESCCOBERTURA?.toUpperCase().includes('CORPORALES') ||
       c.COBERTURA === 'A')
    );
    if (lesionesCobertura) {
      limites.push({
        tipo: 'lesiones_corporales' as const,
        limitePorPersona: lesionesCobertura.LIMITE?.split('/')[0]?.trim() || '',
        limitePorAccidente: lesionesCobertura.LIMITE?.split('/')[1]?.trim() || '',
        descripcion: 'Lesiones Corporales'
      });
    }
    
    const propiedadCobertura = apiCoberturas.find((c: any) => 
      (c.DESCCOBERTURA?.toUpperCase().includes('PROPIEDAD') || 
       c.DESCCOBERTURA?.toUpperCase().includes('DAÑOS') ||
       c.COBERTURA === 'B')
    );
    if (propiedadCobertura) {
      limites.push({
        tipo: 'daños_propiedad' as const,
        limitePorPersona: propiedadCobertura.LIMITE || '',
        descripcion: 'Daños a la Propiedad'
      });
    }
    
    const medicosCobertura = apiCoberturas.find((c: any) => 
      (c.DESCCOBERTURA?.toUpperCase().includes('MÉDICOS') || 
       c.DESCCOBERTURA?.toUpperCase().includes('MEDICOS') ||
       c.DESCCOBERTURA?.toUpperCase().includes('GASTOS'))
    );
    if (medicosCobertura) {
      limites.push({
        tipo: 'gastos_medicos' as const,
        limitePorPersona: medicosCobertura.LIMITE?.split('/')[0]?.trim() || '',
        limitePorAccidente: medicosCobertura.LIMITE?.split('/')[1]?.trim() || '',
        descripcion: 'Gastos Médicos'
      });
    }
    
    // Beneficios según plan type
    // IMPORTANTE: Básico y Premium tienen MISMA TARIFA pero diferentes beneficios
    const esPremium = quoteData.planType === 'premium';
    const beneficios = [];
    
    // BENEFICIOS COMUNES (están en AMBOS planes)
    const beneficiosComunes = [
      { nombre: 'Asistencia Vial Básica', descripcion: '1 evento/año', incluido: true },
      { nombre: 'Asistencia Médica Telefónica', descripcion: '24/7', incluido: true },
      { nombre: 'Inspección IN SITU', descripcion: 'Incluido', incluido: true },
      { nombre: 'Grúa hasta $150', descripcion: '2 eventos/año', incluido: true },
    ];
    
    beneficios.push(...beneficiosComunes);
    
    if (esPremium) {
      // BENEFICIOS ADICIONALES SOLO EN PREMIUM (Endoso Porcelana)
      beneficios.push(
        { nombre: 'Muerte accidental conductor', descripcion: '$500', incluido: true },
        { nombre: 'Auto de alquiler', descripcion: '10 días', incluido: true },
        { nombre: 'Cobertura extraterritorial', descripcion: 'Hasta Costa Rica', incluido: true },
        { nombre: 'Vehículo de reemplazo', descripcion: 'Por robo/hurto', incluido: true },
        { nombre: 'Defensa penal', descripcion: 'Hasta $2,000', incluido: true },
        { nombre: 'RC auto sustituto', descripcion: 'Incluido', incluido: true },
        { nombre: '100% reembolso deducible', descripcion: 'Sin culpa', incluido: true },
        { nombre: 'Protección objetos personales', descripcion: 'Hasta $100/evento', incluido: true }
      );
    }
    
    // Endosos según plan type
    const endosos = [];
    
    // FEDPA PACK está en AMBOS planes (básico y premium)
    endosos.push(
      { codigo: 'FAB', nombre: 'FEDPA PACK', descripcion: 'Paquete completo de beneficios', incluido: true }
    );
    
    if (esPremium) {
      // Premium AGREGA Endoso Porcelana (beneficios máximos)
      endosos.push(
        { codigo: 'PORCELANA', nombre: 'Endoso Porcelana', descripcion: 'Cobertura ampliada y beneficios premium', incluido: true },
        { codigo: 'H-1', nombre: 'Muerte accidental conductor', descripcion: '$500', incluido: true }
      );
    }
    
    // Retornar en formato compatible con QuoteComparison CON TODOS LOS DETALLES
    return {
      id: 'fedpa-real',
      insurerName: 'FEDPA Seguros',
      planType: esPremium ? 'premium' as const : 'basico' as const,
      isRecommended: esPremium,
      annualPremium: primaTotal,
      deductible: deducibleInfo.valor,
      coverages: coberturasDetalladas.map((c: any) => ({
        name: c.nombre,
        included: true,
      })),
      // DATOS COMPLETOS PARA VISUALIZACIÓN
      _coberturasDetalladas: coberturasDetalladas,
      _limites: limites,
      _beneficios: beneficios,
      _endosos: endosos,
      _deducibleInfo: deducibleInfo,
      _sumaAsegurada: quoteData.valorVehiculo || 0,
      _primaBase: cotizacionResult.primaBase || 0,
      _impuesto1: cotizacionResult.impuesto1 || 0,
      _impuesto2: cotizacionResult.impuesto2 || 0,
      // Datos adicionales para emisión
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
          // IMPORTANTE: Ambos usan el MISMO deducible del form, diferencia es el ENDOSO
          try {
            // Plan Básico - SIN endoso premium
            const intBasico = await generateInternacionalRealQuote({ ...input, planType: 'basico' });
            if (intBasico) {
              intBasico.id = 'internacional-basico';
              intBasico.planType = 'basico';
              realQuotes.push(intBasico);
            }
            
            // Plan Premium - CON endoso alto (más beneficios)
            const intPremium = await generateInternacionalRealQuote({ ...input, planType: 'premium' });
            if (intPremium) {
              intPremium.id = 'internacional-premium';
              intPremium.planType = 'premium';
              intPremium.isRecommended = true;
              realQuotes.push(intPremium);
            }
          } catch (error) {
            console.error('Error obteniendo cotizaciones INTERNACIONAL:', error);
            toast.error('Error al obtener cotizaciones de INTERNACIONAL');
          }
          
          // FEDPA: generar plan básico y premium
          // IMPORTANTE: Ambos usan el MISMO deducible del form, diferencia es el ENDOSO PORCELANA
          try {
            // Plan Básico - SIN Endoso Porcelana
            const fedpaBasico = await generateFedpaRealQuote({ ...input, planType: 'basico' });
            if (fedpaBasico) {
              fedpaBasico.id = 'fedpa-basico';
              fedpaBasico.planType = 'basico';
              realQuotes.push(fedpaBasico);
            }
            
            // Plan Premium - CON Endoso Porcelana (cobertura máxima)
            const fedpaPremium = await generateFedpaRealQuote({ ...input, planType: 'premium' });
            if (fedpaPremium) {
              fedpaPremium.id = 'fedpa-premium';
              fedpaPremium.planType = 'premium';
              fedpaPremium.isRecommended = true;
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
