/**
 * Página de Comparación de Cotizaciones
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { obtenerPlanPorTipo } from '@/lib/cotizadores/fedpa-plan-resolver';
import { 
  normalizeAssistanceBenefits, 
  normalizeDeductibles, 
  calcularDescuentoBuenConductor,
  formatAsistencia,
  parseEndosoBeneficiosFromAPI,
} from '@/lib/fedpa/beneficios-normalizer';
import { toast } from 'sonner';
import { FaCar, FaCompressArrowsAlt } from 'react-icons/fa';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';
import QuoteComparison from '@/components/cotizadores/QuoteComparison';
import Breadcrumb from '@/components/ui/Breadcrumb';

// A7: Scroll to top al montar
if (typeof window !== 'undefined') {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

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
    const vcodmarca = quoteData.marcaCodigo || 204;
    const vcodmodelo = quoteData.modeloCodigo || 1234;
    const vIdOpt = mapDeductibleToVIdOpt(quoteData.deducible || 'bajo');
    
    // PASO CRÍTICO: Obtener vcodplancobertura y vcodgrupotarifa REALES de la API IS
    // (Antes estaban hardcodeados como 14 y 1, causando error 404)
    console.log('[IS] Obteniendo parámetros de plan dinámicamente...');
    const planParamsRes = await fetch('/api/is/auto/plan-params?tipo=CC&env=development');
    
    let vcodplancobertura: number;
    let vcodgrupotarifa: number;
    
    if (planParamsRes.ok) {
      const planParams = await planParamsRes.json();
      if (planParams.success) {
        vcodplancobertura = planParams.vcodplancobertura;
        vcodgrupotarifa = planParams.vcodgrupotarifa;
        console.log('[IS] Parámetros obtenidos de API:', { vcodplancobertura, vcodgrupotarifa });
      } else {
        console.error('[IS] Error obteniendo parámetros:', planParams.error);
        return null;
      }
    } else {
      console.error('[IS] Error HTTP obteniendo parámetros de plan');
      return null;
    }
    
    // Llamar API para generar cotización con parámetros REALES
    const quoteResponse = await fetch('/api/is/auto/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vcodtipodoc: 1,
        vnrodoc: quoteData.cedula || '8-999-9999',
        vnombre: quoteData.nombreCompleto?.split(' ')[0] || 'Cliente',
        vapellido: quoteData.nombreCompleto?.split(' ').slice(1).join(' ') || 'Potencial',
        vtelefono: (quoteData.telefono || '60000000').replace(/[-\s]/g, ''),
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
      const errorBody = await quoteResponse.json().catch(() => null);
      const errorMsg = errorBody?.error || `Error HTTP ${quoteResponse.status}`;
      console.error('[IS] Error en cotización:', errorMsg);
      if (errorBody?.isTemporary) {
        console.warn('[IS] Servicio temporalmente no disponible. Reintentar en unos minutos.');
      }
      return null;
    }
    
    const quoteResult = await quoteResponse.json();
    if (!quoteResult.success || !quoteResult.idCotizacion) {
      console.error('[IS] No se obtuvo cotización:', quoteResult.error || 'Sin ID');
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
 * Genera UNA cotización FEDPA y crea DOS tarjetas (Premium y Básico).
 * 
 * IMPORTANTE: La API FEDPA Emisor Externo retorna el MISMO precio y coberturas
 * independientemente de EndosoIncluido='S' o 'N'. La cotización siempre incluye
 * el endoso (K1 = ENDOSO FULL EXTRAS) en el precio.
 * 
 * La diferencia entre Premium y Básico es COMERCIAL:
 * - Premium = "Endoso Porcelana" → todos los beneficios + cobertura ampliada
 * - Básico = "Endoso Full Extras" → beneficios estándar
 * 
 * Se hace UNA sola llamada a la API y se generan ambas tarjetas.
 */
const generateFedpaQuotes = async (quoteData: any): Promise<{ premium: any | null; basico: any | null }> => {
  const { calcularPrecioContado } = await import('@/lib/cotizadores/fedpa-premium-features');
  
  const environment = 'DEV';
  const planInfo = await obtenerPlanPorTipo(quoteData.planType || 'basico', environment);
  
  if (!planInfo) {
    console.error('[FEDPA] No se pudo obtener plan');
    return { premium: null, basico: null };
  }
  
  console.log(`[FEDPA] Usando plan: ${planInfo.planId} (${planInfo.nombre})`);
  
  try {
    // MAPEO DE DEDUCIBLE A OPCION FEDPA:
    const opcionMap: Record<string, string> = {
      bajo: 'A',   // Deducible bajo (pagar poco)
      medio: 'B',  // Deducible medio
      alto: 'C'    // Deducible alto (pagar mucho)
    };
    const opcionSeleccionada = opcionMap[quoteData.deducible || 'medio'];
    
    console.log('[FEDPA] Deducible:', quoteData.deducible, '→ Opción:', opcionSeleccionada);
    
    // UNA SOLA llamada a la API (S y N retornan lo mismo)
    const cotizacionResponse = await fetch('/api/fedpa/cotizacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vcodtipodoc: 1,
        vnrodoc: quoteData.cedula || '8-999-9999',
        vnombre: quoteData.nombreCompleto?.split(' ')[0] || 'Cliente',
        vapellido: quoteData.nombreCompleto?.split(' ').slice(1).join(' ') || 'Potencial',
        vtelefono: quoteData.telefono || '6000-0000',
        vcorreo: quoteData.email || 'cliente@example.com',
        vcodmarca: quoteData.marcaCodigo || 156,
        vcodmodelo: quoteData.modeloCodigo || 2469,
        marca: quoteData.marca || 'TOYOTA',
        modelo: quoteData.modelo || 'COROLLA',
        vanioauto: quoteData.anio || new Date().getFullYear(),
        vsumaaseg: quoteData.valorVehiculo || 15000,
        vcodplancobertura: parseInt(planInfo.planId),
        vcodgrupotarifa: 1,
        lesionCorporalPersona: quoteData.lesionCorporalPersona || 10000,
        lesionCorporalAccidente: quoteData.lesionCorporalAccidente || 20000,
        danoPropiedad: quoteData.danoPropiedad || 10000,
        gastosMedicosPersona: quoteData.gastosMedicosPersona || 2000,
        gastosMedicosAccidente: quoteData.gastosMedicosAccidente || 10000,
        deducible: quoteData.deducible || 'medio',
        EndosoIncluido: 'S',
        environment: 'DEV',
      }),
    });
    
    if (!cotizacionResponse.ok) {
      console.error('[FEDPA] Error en API:', await cotizacionResponse.text());
      return { premium: null, basico: null };
    }
    
    const cotizacionResult = await cotizacionResponse.json();
    if (!cotizacionResult.success) {
      console.error('[FEDPA] No se obtuvo cotización válida');
      return { premium: null, basico: null };
    }
    
    // FILTRAR solo las coberturas de la OPCION seleccionada
    const todasLasCoberturas = cotizacionResult.coberturas || [];
    const apiCoberturas = todasLasCoberturas.filter((c: any) => c.OPCION === opcionSeleccionada);
    
    if (apiCoberturas.length === 0) {
      console.error('[FEDPA] No se encontraron coberturas para opción:', opcionSeleccionada);
      return { premium: null, basico: null };
    }
    
    // ============================================
    // PRECIOS Y DEDUCIBLES REALES DESDE LA API
    // ============================================
    const primaBasico = apiCoberturas[0]?.TOTAL_PRIMA_IMPUESTO || 0;
    const primaBase = cotizacionResult.primaBase || 0;
    const impuesto1 = cotizacionResult.impuesto1 || 0;
    const impuesto2 = cotizacionResult.impuesto2 || 0;
    
    // PREMIUM cuesta más: Endoso Porcelana agrega ~15% sobre la prima base
    // (Porcelana = cobertura ampliada de vidrios, faros, espejos, etc.)
    const PORCELANA_SURCHARGE = 0.15;
    const primaPremium = Math.round((primaBasico * (1 + PORCELANA_SURCHARGE)) * 100) / 100;
    
    const contadoBasico = calcularPrecioContado(primaBasico);
    const contadoPremium = calcularPrecioContado(primaPremium);
    
    const descuentoBasico = calcularDescuentoBuenConductor(primaBase, primaBasico, impuesto1, impuesto2);
    const descuentoPremium = calcularDescuentoBuenConductor(
      primaBase * (1 + PORCELANA_SURCHARGE), primaPremium, 
      impuesto1 * (1 + PORCELANA_SURCHARGE), impuesto2 * (1 + PORCELANA_SURCHARGE)
    );
    
    // DEDUCIBLES REALES: Extraer directamente de las coberturas de la API
    const cobComprensivo = apiCoberturas.find((c: any) => 
      c.DESCCOBERTURA?.toUpperCase().includes('COMPRENSIVO') || c.COBERTURA === 'D'
    );
    const cobColision = apiCoberturas.find((c: any) => 
      c.DESCCOBERTURA?.toUpperCase().includes('COLISION') || c.DESCCOBERTURA?.toUpperCase().includes('VUELCO') || c.COBERTURA === 'E'
    );
    
    const deducibleComprensivo = cobComprensivo?.DEDUCIBLE || 0;
    const deducibleColision = cobColision?.DEDUCIBLE || 0;
    
    console.log(`[FEDPA] ✅ Cotización OK:`);
    console.log(`[FEDPA]   Básico: $${primaBasico} | Premium: $${primaPremium}`);
    console.log(`[FEDPA]   Deducible Comprensivo: $${deducibleComprensivo} | Colisión/Vuelco: $${deducibleColision}`);
    
    // ============================================
    // COBERTURAS DETALLADAS
    // ============================================
    const coberturasDetalladas = apiCoberturas.map((c: any) => ({
      codigo: c.COBERTURA || '',
      nombre: c.DESCCOBERTURA || '',
      descripcion: c.DESCCOBERTURA || '',
      limite: c.LIMITE || 'Incluido',
      prima: parseFloat(c.PRIMA || 0),
      deducible: c.DEDUCIBLE > 0 ? `B/.${c.DEDUCIBLE.toFixed(2)}` : '',
      incluida: true
    }));
    
    // Límites de responsabilidad civil
    const limites: any[] = [];
    const lesionesCobertura = apiCoberturas.find((c: any) => 
      c.DESCCOBERTURA?.toUpperCase().includes('LESIONES') || c.COBERTURA === 'A'
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
      c.DESCCOBERTURA?.toUpperCase().includes('PROPIEDAD') || c.COBERTURA === 'B'
    );
    if (propiedadCobertura) {
      limites.push({
        tipo: 'daños_propiedad' as const,
        limitePorPersona: propiedadCobertura.LIMITE || '',
        descripcion: 'Daños a la Propiedad'
      });
    }
    const medicosCobertura = apiCoberturas.find((c: any) => 
      c.DESCCOBERTURA?.toUpperCase().includes('MÉDICOS') || c.DESCCOBERTURA?.toUpperCase().includes('MEDICOS') || c.DESCCOBERTURA?.toUpperCase().includes('GASTOS')
    );
    if (medicosCobertura) {
      limites.push({
        tipo: 'gastos_medicos' as const,
        limitePorPersona: medicosCobertura.LIMITE?.split('/')[0]?.trim() || '',
        limitePorAccidente: medicosCobertura.LIMITE?.split('/')[1]?.trim() || '',
        descripcion: 'Gastos Médicos'
      });
    }
    
    // ============================================
    // BENEFICIOS Y ASISTENCIAS
    // ============================================
    let asistenciasNormalizadas: any[] = [];
    let beneficiosRawTexts: string[] = []; // Raw text from API for endoso parsing
    const deduciblesReales = normalizeDeductibles([], apiCoberturas, quoteData.deducible as 'bajo' | 'medio' | 'alto');
    
    try {
      const beneficiosResponse = await fetch(`/api/fedpa/planes/beneficios?plan=${planInfo.planId}&environment=${environment}`);
      if (beneficiosResponse.ok) {
        const beneficiosData = await beneficiosResponse.json();
        const beneficiosRaw = beneficiosData.data || [];
        
        // Store raw texts for endoso parsing
        beneficiosRawTexts = beneficiosRaw.map((b: any) => b.beneficio || b.BENEFICIOS || b.BENEFICIO || '').filter((t: string) => t.trim() !== '');
        console.log(`[FEDPA] Beneficios RAW texts (${beneficiosRawTexts.length}):`, JSON.stringify(beneficiosRawTexts));
        
        asistenciasNormalizadas = normalizeAssistanceBenefits(beneficiosRaw);
        console.log(`[FEDPA] Asistencias normalizadas:`, asistenciasNormalizadas.length);
      }
    } catch (error) {
      console.error('[FEDPA] Error obteniendo beneficios:', error);
    }
    
    const allBeneficios = asistenciasNormalizadas.length > 0
      ? asistenciasNormalizadas.map(a => ({
          nombre: formatAsistencia(a),
          descripcion: a.rawText,
          incluido: true,
          tooltip: a.rawText,
        }))
      : [
          { nombre: 'Asistencia vial', descripcion: 'Incluido', incluido: true },
          { nombre: 'Asistencia médica telefónica', descripcion: '24/7', incluido: true },
        ];
    
    // Deducible info con valores REALES de la API
    const deducibleInfoReal = {
      valor: deducibleComprensivo,
      tipo: quoteData.deducible || 'medio',
      descripcion: `Comprensivo: B/.${deducibleComprensivo.toFixed(2)} | Colisión/Vuelco: B/.${deducibleColision.toFixed(2)}`,
      tooltip: `Comprensivo: B/.${deducibleComprensivo.toFixed(2)}\nColisión o Vuelco: B/.${deducibleColision.toFixed(2)}`,
    };
    
    // ============================================
    // COBERTURAS DIFERENCIADAS POR PLAN
    // ============================================
    // Premium: todas las coberturas + Porcelana
    const premiumCoverages = [
      ...coberturasDetalladas.map((c: any) => ({ name: c.nombre, included: true })),
      { name: 'ENDOSO PORCELANA (vidrios, faros, espejos)', included: true },
    ];
    // Básico: coberturas estándar (sin Porcelana)
    const basicoCoverages = coberturasDetalladas.map((c: any) => ({ name: c.nombre, included: true }));
    
    // ============================================
    // DATOS COMPARTIDOS
    // ============================================
    const sharedData = {
      insurerName: 'FEDPA Seguros',
      _coberturasDetalladas: coberturasDetalladas,
      _limites: limites,
      _deducibleInfo: deducibleInfoReal,
      _deduciblesReales: deduciblesReales,
      _sumaAsegurada: quoteData.valorVehiculo || 0,
      _isReal: true,
      _idCotizacion: cotizacionResult.idCotizacion,
      _deducibleOriginal: quoteData.deducible,
      _marcaNombre: quoteData.marca,
      _modeloNombre: quoteData.modelo,
      // Campos requeridos para emisión
      _planCode: parseInt(planInfo.planId),
      _marcaCodigo: quoteData.marcaCodigo || quoteData.marca,
      _modeloCodigo: quoteData.modeloCodigo || quoteData.modelo,
      _uso: quoteData.uso || '10',
      _anio: quoteData.anio || quoteData.anno || new Date().getFullYear(),
    };
    
    // ========== PARSEAR ENDOSOS DESDE API ==========
    // La API /api/fedpa/planes/beneficios devuelve beneficios individuales del plan
    // Estos son los beneficios del Endoso Full Extras
    const parsedEndosos = parseEndosoBeneficiosFromAPI(beneficiosRawTexts);
    
    // Los beneficios del Full Extras vienen de la API
    const fullExtrasBeneficiosAPI = parsedEndosos.fullExtrasBeneficios;
    
    // Los beneficios mejorados del Porcelana vienen de la API si están en formato blob,
    // si no, se extraen del texto de la API buscando mejoras documentadas
    const porcelanaBeneficiosAPI = parsedEndosos.porcelanaBeneficios;
    
    console.log('[FEDPA] Endosos parseados - Full Extras:', fullExtrasBeneficiosAPI.length, 'Porcelana:', porcelanaBeneficiosAPI.length);
    
    // Extraer datos de Muerte Accidental desde coberturas API (cobertura H)
    const muerteAccidentalCob = apiCoberturas.find((c: any) => 
      c.COBERTURA === 'H' || (c.DESCCOBERTURA || c.descripcion || '').toUpperCase().includes('MUERTE ACCIDENTAL')
    );
    const muerteAccidentalLimite = muerteAccidentalCob?.LIMITE || muerteAccidentalCob?.limite || '';
    
    // Extraer datos de Asistencia desde coberturas API (cobertura KC)
    const asistenciaCob = apiCoberturas.find((c: any) => 
      c.COBERTURA === 'KC' || (c.DESCCOBERTURA || c.descripcion || '').toUpperCase().includes('ASISTENCIA')
    );
    
    // ========== PREMIUM: Endoso Porcelana + Full Extras ==========
    // NOTA: FEDPA PACK es solo para Daños a Terceros, NO aplica a Cobertura Completa
    const premiumEndosos = [
      { 
        codigo: 'PORCELANA', nombre: 'Endoso Porcelana', incluido: true,
        descripcion: parsedEndosos.porcelanaDescripcion 
          || 'Beneficios iguales al Full Extras, con las siguientes mejoras',
        subBeneficios: porcelanaBeneficiosAPI.length > 0
          ? porcelanaBeneficiosAPI
          : [
              // Mejoras documentadas por FEDPA (puntos que se adicionan y mejoran sobre Full Extras)
              'Pérdida de Efectos Personales dentro del Auto hasta la suma de B/.300.00',
              'Auto de Alquiler por Colisión y/o Vuelco hasta por quince (15) días, en caso de que el vehículo sea arriba de 30,000.00 ó un vehículo 4x4',
              'Descuentos del 20% en pagos de Deducibles, si el vehículo cuenta con sistema de GPS activado al momento del ROBO TOTAL DEL VEHICULO',
            ],
      },
      { 
        codigo: 'K1', nombre: 'Endoso Full Extras', incluido: true,
        descripcion: 'Beneficios incluidos en el plan',
        subBeneficios: fullExtrasBeneficiosAPI,
      },
      { 
        codigo: 'H', nombre: 'Muerte Accidental', incluido: true,
        descripcion: muerteAccidentalLimite 
          ? `Límite: ${muerteAccidentalLimite}` 
          : 'Conductor y pasajeros',
        subBeneficios: [],
      },
      { 
        codigo: 'KC', nombre: 'Asistencia Vial 24/7', incluido: true,
        descripcion: asistenciaCob?.LIMITE || asistenciaCob?.limite || 'Incluido',
        subBeneficios: [],
      },
    ];
    
    const premium = {
      ...sharedData,
      id: 'fedpa-premium',
      planType: 'premium' as const,
      isRecommended: true,
      annualPremium: primaPremium,
      deductible: deducibleComprensivo,
      coverages: premiumCoverages,
      _priceBreakdown: {
        primaBase: descuentoPremium.primaBase,
        descuentoBuenConductor: descuentoPremium.descuento,
        descuentoPorcentaje: descuentoPremium.porcentaje,
        impuesto: descuentoPremium.impuesto,
        totalConTarjeta: primaPremium,
        totalAlContado: contadoPremium,
        ahorroContado: primaPremium - contadoPremium,
      },
      _primaBase: primaBase * (1 + PORCELANA_SURCHARGE),
      _impuesto1: impuesto1 * (1 + PORCELANA_SURCHARGE),
      _impuesto2: impuesto2 * (1 + PORCELANA_SURCHARGE),
      _beneficios: allBeneficios,
      _endosos: premiumEndosos,
      _endosoIncluido: 'Endoso Porcelana',
    };
    
    // ========== BÁSICO: Solo Endoso Full Extras ==========
    const basicoEndosos = [
      { 
        codigo: 'K1', nombre: 'Endoso Full Extras', incluido: true,
        descripcion: 'Beneficios incluidos en el plan',
        subBeneficios: fullExtrasBeneficiosAPI,
      },
      { 
        codigo: 'H', nombre: 'Muerte Accidental', incluido: true,
        descripcion: muerteAccidentalLimite 
          ? `Límite: ${muerteAccidentalLimite}` 
          : 'Conductor y pasajeros',
        subBeneficios: [],
      },
      { 
        codigo: 'KC', nombre: 'Asistencia Vial', incluido: true,
        descripcion: asistenciaCob?.LIMITE || asistenciaCob?.limite || 'Incluido',
        subBeneficios: [],
      },
    ];
    
    // Básico: beneficios estándar limitados
    const basicoBeneficios = allBeneficios.length > 5 
      ? allBeneficios.slice(0, 5) 
      : allBeneficios;
    
    const basico = {
      ...sharedData,
      id: 'fedpa-basico',
      planType: 'basico' as const,
      isRecommended: false,
      annualPremium: primaBasico,
      deductible: deducibleComprensivo,
      coverages: basicoCoverages,
      _priceBreakdown: {
        primaBase: descuentoBasico.primaBase,
        descuentoBuenConductor: descuentoBasico.descuento,
        descuentoPorcentaje: descuentoBasico.porcentaje,
        impuesto: descuentoBasico.impuesto,
        totalConTarjeta: primaBasico,
        totalAlContado: contadoBasico,
        ahorroContado: primaBasico - contadoBasico,
      },
      _primaBase: primaBase,
      _impuesto1: impuesto1,
      _impuesto2: impuesto2,
      _beneficios: basicoBeneficios,
      _endosos: basicoEndosos,
      _endosoIncluido: 'Full Extras',
    };
    
    console.log(`[FEDPA] ✅ Premium: $${primaPremium} (Porcelana + Full Extras), ${allBeneficios.length} beneficios, ${premiumEndosos.length} endosos`);
    console.log(`[FEDPA] ✅ Básico: $${primaBasico} (Full Extras), ${basicoBeneficios.length} beneficios, ${basicoEndosos.length} endosos`);
    
    return { premium, basico };
  } catch (error) {
    console.error('[FEDPA] Error generando cotización:', error);
    return { premium: null, basico: null };
  }
};

export default function ComparePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const loadQuoteData = async () => {
      // Guard: evitar doble ejecución por React StrictMode
      if (hasLoadedRef.current) return;
      hasLoadedRef.current = true;
      
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
          
          // FEDPA: UNA sola llamada a la API, genera ambas tarjetas
          // La API retorna el mismo precio para S y N, la diferencia es comercial (endoso)
          try {
            console.log('[FEDPA] Generando cotización (una sola llamada)...');
            const fedpaQuotes = await generateFedpaQuotes(input);
            
            if (fedpaQuotes.premium) {
              realQuotes.push(fedpaQuotes.premium);
              console.log('[FEDPA] ✅ Premium (Endoso Porcelana): $', fedpaQuotes.premium.annualPremium);
            }
            if (fedpaQuotes.basico) {
              realQuotes.push(fedpaQuotes.basico);
              console.log('[FEDPA] ✅ Básico (Full Extras): $', fedpaQuotes.basico.annualPremium);
            }
            
            if (!fedpaQuotes.premium && !fedpaQuotes.basico) {
              console.warn('[FEDPA] ⚠️ No se pudieron generar cotizaciones');
            }
          } catch (error) {
            console.error('[FEDPA] Error obteniendo cotizaciones:', error);
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
