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
import { trackQuoteCreated } from '@/lib/adm-cot/track-quote';

// A7: Scroll to top al montar
if (typeof window !== 'undefined') {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

/**
 * Mapeo de deducibles del formulario a vIdOpt de INTERNACIONAL
 * IS retorna 3 opciones en Table/Table1/Table2:
 *   Option 1 (Table)  = deducible más bajo  → prima más alta
 *   Option 2 (Table1) = deducible medio     → prima media
 *   Option 3 (Table2) = deducible más alto  → prima más baja
 */
const mapDeductibleToVIdOpt = (deductible: string): 1 | 2 | 3 => {
  switch (deductible) {
    case 'bajo': return 1;  // Deducible bajo (montos bajos) → prima alta
    case 'medio': return 2; // Deducible medio → prima media
    case 'alto': return 3;  // Deducible alto (montos altos) → prima baja
    default: return 1;
  }
};

// ============================================
// IS ENDOSOS: Definiciones oficiales desde imagen de IS
// ============================================
const IS_ENDOSOS = {
  PLUS: {
    codigo: 'PLUS',
    nombre: 'Endoso Plus',
    costoAnual: 35.00,
    beneficios: [
      'Alquiler de auto por colisión: Hasta 10 días',
      'Muerte accidental: B/.10,000 por asegurado',
      'Pérdida de efectos personales: Hasta B/.100 por asegurado',
      'Adelanto de gastos médicos por hospitalización: Hasta B/.500 por cada 1 conductor y 4 ocupantes',
    ],
  },
  CENTENARIO: {
    codigo: 'CENTENARIO',
    nombre: 'Endoso Plus Centenario',
    costoAnual: 60.00,
    beneficios: [
      'Alquiler de auto por colisión: Hasta 15 días',
      'Muerte accidental: B/.15,000 por asegurado',
      'Revisado sin costo',
      'Pérdida de efectos personales: Hasta B/.350 por asegurado',
      'Adelanto de gastos médicos por hospitalización: Hasta B/.500 por cada 1 conductor y 4 ocupantes',
      'Bono de mantenimiento: B/.50',
      'Descuento en deducible de comprensivo: 20%',
      'Asistencia en viaje, hospedaje, transporte o renta de vehículo: Hasta B/.100',
      'Descuento en póliza de optiseguro residencial: 30%',
      'Adelanto de gastos funerarios: Hasta B/.1,500 para la conductora y hasta B/.500 por ocupante',
    ],
  },
  // Beneficios exclusivos del plan (no endoso)
  BENEFICIOS_GENERALES: [
    'Grúa (desperfectos mecánicos) hasta B/.150 o máximo 3 eventos por año',
    'Alquiler de auto por 30 días en caso de robo, después de las 72 horas',
    'No aplica depreciación para autos nuevos 0 kms en caso de pérdida total el primer año',
    'Cobertura extraterritorial por 30 días a Costa Rica',
    'Servicios de Ambulancia, 24 horas los 365 días de año',
    'Descuentos especiales en la instalación de sistemas de alarma y accesorios en centros autorizados',
    'Asistencia Legal',
    'Devolución del 100% en el deducible de colisión',
  ],
};

/**
 * Genera cotización REAL con INTERNACIONAL usando las APIs
 * UNA sola llamada a la API, genera datos para ambas tarjetas (básico y premium)
 */
const generateInternacionalQuotes = async (quoteData: any): Promise<{ basico: any | null; premium: any | null }> => {
  try {
    const vcodmarca = quoteData.marcaCodigo || 204;
    const vcodmodelo = quoteData.modeloCodigo || 1234;
    const vIdOpt = mapDeductibleToVIdOpt(quoteData.deducible || 'bajo');
    
    // Plan params: CC Particular defaults (cached 24h server-side, rarely change)
    const vcodplancobertura = quoteData.vcodplancobertura || 29;  // CC 5/10
    const vcodgrupotarifa = quoteData.vcodgrupotarifa || 20;      // PARTICULAR
    
    // ── UNA SOLA llamada: quote + coberturas combinados en el backend ──
    // Elimina 2 round-trips cliente→servidor (plan-params + coberturas separado)
    console.log('[IS] Cotización completa (quote+coberturas) en una llamada...');
    const t0 = performance.now();
    
    const quoteResponse = await fetch('/api/is/auto/quote-full', {
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
    
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    
    if (!quoteResponse.ok) {
      const errorBody = await quoteResponse.json().catch(() => null);
      console.error(`[IS] Error en cotización (${elapsed}s):`, errorBody?.error || `HTTP ${quoteResponse.status}`);
      return { basico: null, premium: null };
    }
    
    const result = await quoteResponse.json();
    if (!result.success || !result.idCotizacion) {
      console.error(`[IS] No se obtuvo cotización (${elapsed}s):`, result.error || 'Sin ID');
      return { basico: null, premium: null };
    }
    
    const idCotizacion = result.idCotizacion;
    const apiPrimaTotal = result.primaTotal;
    const nroCotizacion = result.nroCotizacion;
    console.log(`[IS] ✅ Cotización completa en ${elapsed}s | ID: ${idCotizacion} | NroCot: ${nroCotizacion} | PTOTAL: ${apiPrimaTotal}`);
    if (result._timing) {
      console.log(`[IS] Timing: quote=${result._timing.quoteMs}ms coberturas=${result._timing.coberturasMs}ms total=${result._timing.totalMs}ms`);
    }
    
    // Coberturas come in the same response — no extra round-trip needed
    const coberturasResult = { success: !!result.coberturas, data: result.coberturas };
    if (!coberturasResult.success) {
      console.error('[IS] No se obtuvieron coberturas:', result.coberturasError);
      return { basico: null, premium: null };
    }
    
    
    // ============================================
    // Helper: IS returns PRIMA1 as strings with comma thousands separator
    // e.g. "1,259.58" — parseFloat would return 1, so we strip commas first
    // ============================================
    const parsePrima = (val: string | number | null | undefined): number => {
      if (val === null || val === undefined || val === '') return 0;
      const str = String(val).replace(/,/g, '');
      return parseFloat(str) || 0;
    };
    
    // ============================================
    // COBERTURAS: IS retorna 3 tablas (Table=opción 1, Table1=opción 2, Table2=opción 3)
    // Opción 1 = deducible más bajo (prima más alta)
    // Opción 3 = deducible más alto (prima más baja)
    // Seleccionar la tabla correcta según el deducible escogido por el usuario
    // ============================================
    const tableKey = vIdOpt === 1 ? 'Table' : vIdOpt === 2 ? 'Table1' : 'Table2';
    const apiCoberturas = coberturasResult.data?.[tableKey] || coberturasResult.data?.Table || [];
    console.log(`[IS] Usando coberturas de ${tableKey} (opción ${vIdOpt}, deducible: ${quoteData.deducible})`);
    
    // ============================================
    // PRECIO: Sumar PRIMA1 de la opción seleccionada (prima bruta)
    // Los valores PRIMA1 vienen con coma de miles (ej: "1,259.58")
    // ============================================
    let primaSumBruta = 0;
    apiCoberturas.forEach((c: any) => { primaSumBruta += parsePrima(c.PRIMA1); });
    
    // ============================================
    // DESCUENTO BUENA EXPERIENCIA:
    // PTOTAL de generarcotizacion = Prima Neta de Opción 1 (post-descuento + 6% impuesto).
    // IS aplica un descuento por buena experiencia que varía por cliente/vehículo.
    // Derivamos el factor de descuento comparando PTOTAL con la suma PRIMA1 de Table (Opt1).
    // Luego aplicamos ese mismo factor proporcionalmente a la opción seleccionada.
    // ============================================
    const tableSumOpt1 = (coberturasResult.data?.Table || []).reduce(
      (sum: number, c: any) => sum + parsePrima(c.PRIMA1), 0
    );
    
    let descuentoFactor = 1; // 1 = sin descuento, <1 = hay descuento
    let descuentoPorcentaje = 0;
    let descuentoTotal = 0;
    
    if (apiPrimaTotal && apiPrimaTotal > 0 && tableSumOpt1 > 0) {
      const preTaxPTOTAL = apiPrimaTotal / 1.06; // Quitar 6% impuesto
      descuentoFactor = preTaxPTOTAL / tableSumOpt1;
      
      // Solo aplicar si hay descuento real (factor < 0.99 para evitar errores de redondeo)
      if (descuentoFactor < 0.99) {
        descuentoPorcentaje = Math.round((1 - descuentoFactor) * 10000) / 100; // ej: 47.50%
        const primaBrutaSelectedOpt = primaSumBruta;
        const primaDescontada = primaBrutaSelectedOpt * descuentoFactor;
        descuentoTotal = Math.round((primaBrutaSelectedOpt - primaDescontada) * 100) / 100;
        console.log(`[IS] ✅ Descuento buena experiencia detectado: ${descuentoPorcentaje}% (factor ${descuentoFactor.toFixed(4)})`);
        console.log(`[IS]   Prima bruta Opt${vIdOpt}: $${primaBrutaSelectedOpt.toFixed(2)} → descontada: $${primaDescontada.toFixed(2)} (ahorro: $${descuentoTotal.toFixed(2)})`);
      } else {
        descuentoFactor = 1; // No hay descuento significativo
      }
    }
    
    // primaBase = suma PRIMA1 de la opción seleccionada × factor de descuento
    const primaBase = Math.round(primaSumBruta * descuentoFactor * 100) / 100;
    
    console.log(`[IS] Prima opción ${vIdOpt}: bruta=$${primaSumBruta.toFixed(2)} neta=$${primaBase.toFixed(2)} (PTOTAL=${apiPrimaTotal})`);
    console.log(`[IS] Opt1 sum=$${tableSumOpt1.toFixed(2)} factor=${descuentoFactor.toFixed(4)} descuento=${descuentoPorcentaje}%`);
    
    // ============================================
    // DEDUCIBLES: Ya leemos la tabla correcta (Table/Table1/Table2) según vIdOpt
    // Los valores DEDUCIBLE1 ya corresponden a la opción seleccionada
    // ============================================
    const coberturaComprensivo = apiCoberturas.find((c: any) => 
      c.COBERTURA?.toUpperCase().includes('COMPRENSIVO')
    );
    const coberturaColision = apiCoberturas.find((c: any) => 
      c.COBERTURA?.toUpperCase().includes('COLISION') || 
      c.COBERTURA?.toUpperCase().includes('VUELCO')
    );
    
    const dedComprensivo = parsePrima(coberturaComprensivo?.DEDUCIBLE1);
    const dedColision = parsePrima(coberturaColision?.DEDUCIBLE1);
    
    const deducibleSeleccion = quoteData.deducible || 'bajo';
    
    console.log(`[IS] Deducibles reales de API (opción ${vIdOpt}): comp=$${dedComprensivo} col=$${dedColision}`);
    
    const deducibleInfo = {
      valor: dedColision,
      tipo: deducibleSeleccion,
      descripcion: `Colisión/Vuelco: ${dedColision.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Comprensivo: ${dedComprensivo.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      tooltip: `Colisión/Vuelco: $${dedColision.toLocaleString('en-US', { minimumFractionDigits: 2 })}\nComprensivo: $${dedComprensivo.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    };
    
    // ============================================
    // COBERTURAS DETALLADAS
    // ============================================
    const coberturasDetalladas = apiCoberturas.map((c: any) => ({
      codigo: c.COD_AMPARO,
      nombre: c.COBERTURA,
      descripcion: c.COBERTURA,
      limite: c.LIMITES || c.LIMITES2 || 'Incluido',
      prima: parsePrima(c.PRIMA1),
      deducible: c.DEDUCIBLE1 || '', // Ya correcto para la opción seleccionada
      incluida: true,
      tieneDescuento: c.SN_DESCUENTO === 'S',
    }));
    
    // Límites de responsabilidad civil
    const limites: any[] = [];
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
    
    // ============================================
    // DATOS COMPARTIDOS
    // ============================================
    const sharedData = {
      insurerName: 'INTERNACIONAL de Seguros',
      _coberturasDetalladas: coberturasDetalladas,
      _limites: limites,
      _deducibleInfo: deducibleInfo,
      _deduciblesReales: {
        comprensivo: dedComprensivo > 0 ? { amount: dedComprensivo, label: 'Comprensivo' } : null,
        colisionVuelco: dedColision > 0 ? { amount: dedColision, label: 'Colisión/Vuelco' } : null,
      },
      _sumaAsegurada: quoteData.valorVehiculo || 0,
      _isReal: true,
      _idCotizacion: idCotizacion,
      _nroCotizacion: nroCotizacion,
      _allCoberturas: coberturasResult.data, // All 3 tables: Table (opt1), Table1 (opt2), Table2 (opt3)
      _apiPrimaTotal: apiPrimaTotal, // PTOTAL from generarcotizacion (Opt1 post-discount + 6% tax)
      _descuentoFactor: descuentoFactor,
      _vcodmarca: vcodmarca,
      _vcodmodelo: vcodmodelo,
      _vcodplancobertura: vcodplancobertura,
      _vcodgrupotarifa: vcodgrupotarifa,
      _vIdOpt: vIdOpt,
      _deducibleOriginal: quoteData.deducible,
      _marcaNombre: quoteData.marca,
      _modeloNombre: quoteData.modelo,
      _descuentoBuenaExp: descuentoTotal,
      _descuentoPorcentaje: descuentoPorcentaje,
    };
    
    // ============================================
    // IMPUESTOS IS: 5% impuesto sobre primas + 1% timbres = 6% total
    // ============================================
    const IS_TAX_RATE = 0.06; // 6% (5% impuesto + 1% timbres)
    
    // ============================================
    // BÁSICO: Endoso Plus ya incluido en coberturas (COD_AMPARO 19 / BENEFICIO PLUS)
    // La suma de PRIMA1 ya incluye el endoso Plus $35
    // ============================================
    const subtotalBasico = primaBase; // Suma PRIMA1 de la opción seleccionada
    const impuestoBasico = Math.round(subtotalBasico * IS_TAX_RATE * 100) / 100;
    const primaBasico = Math.round((subtotalBasico + impuestoBasico) * 100) / 100;
    const basicoEndosos = [
      {
        codigo: IS_ENDOSOS.PLUS.codigo,
        nombre: IS_ENDOSOS.PLUS.nombre,
        incluido: true,
        descripcion: `Incluido en la prima (B/.${IS_ENDOSOS.PLUS.costoAnual.toFixed(2)})`,
        subBeneficios: IS_ENDOSOS.PLUS.beneficios,
      },
    ];
    
    const basico = {
      ...sharedData,
      id: 'internacional-basico',
      planType: 'basico' as const,
      isRecommended: false,
      annualPremium: primaBasico,
      deductible: deducibleInfo.valor,
      coverages: coberturasDetalladas.map((c: any) => ({ name: c.nombre, included: true })),
      _priceBreakdown: {
        primaBruta: primaSumBruta,
        primaBase: primaBase,
        descuentoBuenConductor: descuentoTotal,
        descuentoPorcentaje: descuentoPorcentaje,
        costoEndoso: 0, // Plus ya incluido en coberturas
        impuesto: impuestoBasico,
        totalConTarjeta: primaBasico,
        totalAlContado: Math.round(primaBasico * 0.95 * 100) / 100,
        ahorroContado: Math.round(primaBasico * 0.05 * 100) / 100,
        descuentoProntoPago: Math.round(primaBasico * 0.05 * 100) / 100,
      },
      _beneficios: IS_ENDOSOS.BENEFICIOS_GENERALES.map(b => ({ nombre: b, descripcion: b, incluido: true })),
      _endosos: basicoEndosos,
      _endosoIncluido: 'Endoso Plus',
      _endosoTexto: 'ENDOSO PLUS'
    };
    
    // ============================================
    // PREMIUM: Centenario upgrade = $60 - $35 (Plus ya incluido) = $25 extra
    // Solo sumar la diferencia del upgrade, no el costo completo
    // ============================================
    const centenarioUpgrade = IS_ENDOSOS.CENTENARIO.costoAnual - IS_ENDOSOS.PLUS.costoAnual; // $60 - $35 = $25
    const subtotalPremium = primaBase + centenarioUpgrade;
    const impuestoPremium = Math.round(subtotalPremium * IS_TAX_RATE * 100) / 100;
    const primaPremium = Math.round((subtotalPremium + impuestoPremium) * 100) / 100;
    const premiumEndosos = [
      {
        codigo: IS_ENDOSOS.CENTENARIO.codigo,
        nombre: IS_ENDOSOS.CENTENARIO.nombre,
        incluido: true,
        descripcion: `Upgrade: +B/.${centenarioUpgrade.toFixed(2)} sobre Plus incluido`,
        subBeneficios: IS_ENDOSOS.CENTENARIO.beneficios,
      },
      {
        codigo: IS_ENDOSOS.PLUS.codigo,
        nombre: IS_ENDOSOS.PLUS.nombre,
        incluido: true,
        descripcion: 'Incluido en la prima base',
        subBeneficios: IS_ENDOSOS.PLUS.beneficios,
      },
    ];
    
    const premium = {
      ...sharedData,
      id: 'internacional-premium',
      planType: 'premium' as const,
      isRecommended: true,
      annualPremium: primaPremium,
      deductible: deducibleInfo.valor,
      coverages: [
        ...coberturasDetalladas.map((c: any) => ({ name: c.nombre, included: true })),
        { name: 'ENDOSO PLUS CENTENARIO (beneficios mejorados)', included: true },
      ],
      _priceBreakdown: {
        primaBruta: primaSumBruta,
        primaBase: primaBase,
        descuentoBuenConductor: descuentoTotal,
        descuentoPorcentaje: descuentoPorcentaje,
        costoEndoso: centenarioUpgrade, // Solo el delta $25 (Plus ya en coberturas)
        impuesto: impuestoPremium,
        totalConTarjeta: primaPremium,
        totalAlContado: Math.round(primaPremium * 0.95 * 100) / 100,
        ahorroContado: Math.round(primaPremium * 0.05 * 100) / 100,
        descuentoProntoPago: Math.round(primaPremium * 0.05 * 100) / 100,
      },
      _beneficios: IS_ENDOSOS.BENEFICIOS_GENERALES.map(b => ({ nombre: b, descripcion: b, incluido: true })),
      _endosos: premiumEndosos,
      _endosoIncluido: 'Endoso Plus Centenario',
      _endosoTexto: 'ENDOSO PLUS CENTENARIO'
    };
    
    console.log(`[IS] ✅ Básico: $${primaBasico.toFixed(2)} (Endoso Plus $${IS_ENDOSOS.PLUS.costoAnual})`);
    console.log(`[IS] ✅ Premium: $${primaPremium.toFixed(2)} (Endoso Centenario $${IS_ENDOSOS.CENTENARIO.costoAnual})`);
    if (descuentoTotal > 0) {
      console.log(`[IS] ✅ Descuento buena experiencia aplicado: -$${descuentoTotal.toFixed(2)} (${descuentoPorcentaje}%)`);
    }
    
    return { basico, premium };
  } catch (error) {
    console.error('[INTERNACIONAL] Error generando cotización real:', error);
    return { basico: null, premium: null };
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
  const environment = 'DEV';
  
  // Parallelizar import dinámico + resolución de plan
  const [premiumModule, planInfo] = await Promise.all([
    import('@/lib/cotizadores/fedpa-premium-features'),
    obtenerPlanPorTipo(quoteData.planType || 'basico', environment),
  ]);
  const { calcularPrecioContado } = premiumModule;
  
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
    
    // ── PARALELO: Cotización + Beneficios al mismo tiempo ──
    const cotizacionPromise = fetch('/api/fedpa/cotizacion', {
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
    
    const beneficiosPromise = fetch(`/api/fedpa/planes/beneficios?plan=${planInfo.planId}&environment=${environment}`)
      .then(res => res.ok ? res.json() : null)
      .catch(() => null);
    
    // Esperar ambas en paralelo
    const [cotizacionResponse, beneficiosData] = await Promise.all([cotizacionPromise, beneficiosPromise]);
    
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
    // BENEFICIOS Y ASISTENCIAS (ya obtenidos en paralelo arriba)
    // ============================================
    let asistenciasNormalizadas: any[] = [];
    let beneficiosRawTexts: string[] = [];
    const deduciblesReales = normalizeDeductibles([], apiCoberturas, quoteData.deducible as 'bajo' | 'medio' | 'alto');
    
    if (beneficiosData) {
      const beneficiosRaw = beneficiosData.data || [];
      beneficiosRawTexts = beneficiosRaw.map((b: any) => b.beneficio || b.BENEFICIOS || b.BENEFICIO || '').filter((t: string) => t.trim() !== '');
      console.log(`[FEDPA] Beneficios RAW texts (${beneficiosRawTexts.length}):`, JSON.stringify(beneficiosRawTexts));
      asistenciasNormalizadas = normalizeAssistanceBenefits(beneficiosRaw);
      console.log(`[FEDPA] Asistencias normalizadas:`, asistenciasNormalizadas.length);
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
          
          // ── PARALELO: IS y FEDPA al mismo tiempo ──
          // IS tarda ~28s y FEDPA ~1s. Antes era secuencial (29s+), ahora paralelo (~28s)
          console.log('[Comparar] Generando cotizaciones en PARALELO (IS + FEDPA)...');
          const t0 = Date.now();
          
          const [isResult, fedpaResult] = await Promise.allSettled([
            generateInternacionalQuotes(input),
            generateFedpaQuotes(input),
          ]);
          
          console.log(`[Comparar] Cotizaciones completadas en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
          
          // Procesar resultado INTERNACIONAL
          if (isResult.status === 'fulfilled') {
            const isQuotes = isResult.value;
            if (isQuotes.premium) realQuotes.push(isQuotes.premium);
            if (isQuotes.basico) realQuotes.push(isQuotes.basico);
            if (!isQuotes.basico && !isQuotes.premium) {
              console.warn('[IS] No se pudieron generar cotizaciones');
            }
            // ═══ ADM COT: Track IS quotes ═══
            const isRef = isQuotes.premium?._idCotizacion || isQuotes.basico?._idCotizacion;
            if (isRef) {
              const trackBase = {
                clientName: input.nombreCompleto || 'Anónimo',
                cedula: input.cedula,
                email: input.email,
                phone: input.telefono,
                ramo: 'AUTO',
                coverageType: input.cobertura === 'COMPLETA' ? 'Cobertura Completa' : 'Daños a Terceros',
                vehicleInfo: { marca: input.marca, modelo: input.modelo, anio: input.anio, valor: input.valorVehiculo },
              };
              if (isQuotes.premium) {
                trackQuoteCreated({ ...trackBase, quoteRef: `IS-${isRef}-P`, insurer: 'INTERNACIONAL', planName: 'Premium (Centenario)', annualPremium: isQuotes.premium.annualPremium });
              }
              if (isQuotes.basico) {
                trackQuoteCreated({ ...trackBase, quoteRef: `IS-${isRef}-B`, insurer: 'INTERNACIONAL', planName: 'Básico (Plus)', annualPremium: isQuotes.basico.annualPremium });
              }
            }
          } else {
            console.error('Error obteniendo cotizaciones INTERNACIONAL:', isResult.reason);
            toast.error('Error al obtener cotizaciones de INTERNACIONAL');
          }
          
          // Procesar resultado FEDPA
          if (fedpaResult.status === 'fulfilled') {
            const fedpaQuotes = fedpaResult.value;
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
            // ═══ ADM COT: Track FEDPA quotes ═══
            const fedpaRef = fedpaQuotes.premium?._idCotizacion || fedpaQuotes.basico?._idCotizacion;
            if (fedpaRef) {
              const trackBase = {
                clientName: input.nombreCompleto || 'Anónimo',
                cedula: input.cedula,
                email: input.email,
                phone: input.telefono,
                ramo: 'AUTO',
                coverageType: input.cobertura === 'COMPLETA' ? 'Cobertura Completa' : 'Daños a Terceros',
                vehicleInfo: { marca: input.marca, modelo: input.modelo, anio: input.anio, valor: input.valorVehiculo },
              };
              if (fedpaQuotes.premium) {
                trackQuoteCreated({ ...trackBase, quoteRef: `FEDPA-${fedpaRef}-P`, insurer: 'FEDPA', planName: 'Premium (Porcelana)', annualPremium: fedpaQuotes.premium.annualPremium });
              }
              if (fedpaQuotes.basico) {
                trackQuoteCreated({ ...trackBase, quoteRef: `FEDPA-${fedpaRef}-B`, insurer: 'FEDPA', planName: 'Básico (Full Extras)', annualPremium: fedpaQuotes.basico.annualPremium });
              }
            }
          } else {
            console.error('[FEDPA] Error obteniendo cotizaciones:', fedpaResult.reason);
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
