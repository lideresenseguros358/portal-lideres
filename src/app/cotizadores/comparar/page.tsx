/**
 * Página de Comparación de Cotizaciones
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { obtenerPlanPorTipo, resolverPlanCCPorValor } from '@/lib/cotizadores/fedpa-plan-resolver';
import { resolverCodigoPlanCCIS } from '@/lib/is/plan-cc-resolver';
import { 
  normalizeAssistanceBenefits, 
  normalizeDeductibles, 
  calcularDescuentoBuenConductor,
  formatAsistencia,
  parseEndosoBeneficiosFromAPI,
} from '@/lib/fedpa/beneficios-normalizer';
import { toast } from 'sonner';
import { FaCar, FaCompressArrowsAlt, FaExclamationTriangle } from 'react-icons/fa';
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
    const vcodmarca = quoteData.marcaCodigo || 156;  // 156=TOYOTA (prod)
    const vcodmodelo = quoteData.modeloCodigo || 2436; // 2436=COROLLA (prod)
    const vIdOpt = mapDeductibleToVIdOpt(quoteData.deducible || 'bajo');
    
    // Plan params: Resolver plan CC desde los límites del formulario (LC/DP/GM)
    const vcodplancobertura = resolverCodigoPlanCCIS({
      lesionCorporalPersona: quoteData.lesionCorporalPersona || 10000,
      lesionCorporalAccidente: quoteData.lesionCorporalAccidente || 20000,
      danoPropiedad: quoteData.danoPropiedad || 10000,
      gastosMedicosPersona: quoteData.gastosMedicosPersona || 2000,
      gastosMedicosAccidente: quoteData.gastosMedicosAccidente || 10000,
    });
    console.log(`[IS] Plan CC resuelto: ${vcodplancobertura} (LC=${quoteData.lesionCorporalPersona}/${quoteData.lesionCorporalAccidente} DP=${quoteData.danoPropiedad} GM=${quoteData.gastosMedicosPersona}/${quoteData.gastosMedicosAccidente})`);
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
        codProvincia: quoteData.codProvincia || 8,
        fecNacimiento: quoteData.fechaNacimiento
          ? quoteData.fechaNacimiento.split('-').reverse().join('/')
          : '01/01/1990',
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
    // PREMIUM: Centenario endoso — IS NO cobra extra por Centenario vs Plus.
    // IS factura al mismo precio para ambos planes (endosoTexto va solo como txtComentarios).
    // El precio del plan Premium es IGUAL al Básico para que la caratula coincida con el cobro.
    // ============================================
    const subtotalPremium = primaBase; // mismo base que Básico — IS no diferencia en precio
    const impuestoPremium = Math.round(subtotalPremium * IS_TAX_RATE * 100) / 100;
    const primaPremium = Math.round((subtotalPremium + impuestoPremium) * 100) / 100;
    const premiumEndosos = [
      {
        codigo: IS_ENDOSOS.CENTENARIO.codigo,
        nombre: IS_ENDOSOS.CENTENARIO.nombre,
        incluido: true,
        descripcion: 'Incluido en la prima',
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
        costoEndoso: 0, // IS no cobra extra por Centenario — mismo precio que Básico
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
  const environment = 'PROD';
  
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
  
  // Resolve the correct CC plan based on vehicle value (suma asegurada)
  const valorVehiculo = quoteData.valorVehiculo || 15000;
  const ccPlanResolved = resolverPlanCCPorValor(valorVehiculo);
  const cotizacionPlanId = ccPlanResolved.planId;
  
  console.log(`[FEDPA] Plan genérico: ${planInfo.planId} | Plan CC por valor ($${valorVehiculo}): ${cotizacionPlanId} (${ccPlanResolved.nombre})`);
  
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
        vcodplancobertura: parseInt(cotizacionPlanId),
        vcodgrupotarifa: 1,
        lesionCorporalPersona: quoteData.lesionCorporalPersona || 10000,
        lesionCorporalAccidente: quoteData.lesionCorporalAccidente || 20000,
        danoPropiedad: quoteData.danoPropiedad || 10000,
        gastosMedicosPersona: quoteData.gastosMedicosPersona || 2000,
        gastosMedicosAccidente: quoteData.gastosMedicosAccidente || 10000,
        deducible: quoteData.deducible || 'medio',
        EndosoIncluido: 'S',
        environment: 'PROD',
      }),
    });
    
    const beneficiosPromise = fetch(`/api/fedpa/planes/beneficios?plan=${cotizacionPlanId}&environment=${environment}`)
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
      _planCode: parseInt(cotizacionPlanId),
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

/**
 * Genera cotización REAL con LA REGIONAL usando las APIs
 * Básico = Endoso Básico, Premium = Endoso Plus
 * Deducibles: bajo/medio/alto mapeados según las opciones de REGIONAL
 */
const generateRegionalQuotes = async (quoteData: any): Promise<{ basico: any | null; premium: any | null }> => {
  try {
    const edad = quoteData.fechaNacimiento
      ? Math.floor((Date.now() - new Date(quoteData.fechaNacimiento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 35;

    // Map deducible to REGIONAL endoso codes
    // bajo = endoso 1, medio = endoso 2, alto = endoso 3
    const endosoBasico = '1';
    const endosoPlus = '2';

    const baseParams = {
      nombre: quoteData.nombreCompleto?.split(' ')[0] || 'Cliente',
      apellido: quoteData.nombreCompleto?.split(' ').slice(1).join(' ') || 'Potencial',
      edad,
      sexo: quoteData.sexo || 'M',
      edocivil: 'S',
      codMarca: quoteData.marcaCodigo || 74,
      codModelo: quoteData.modeloCodigo || 1,
      marca: quoteData.marca || '',   // Brand name for IS→Regional normalization
      modelo: quoteData.modelo || '', // Model name for IS→Regional normalization
      anio: quoteData.anio || new Date().getFullYear(),
      valorVeh: quoteData.valorVehiculo || 15000,
      email: quoteData.email || 'cotizacion@web.com',
    };

    console.log('[REGIONAL] Cotizando CC en paralelo (básico + premium)...');
    const t0 = performance.now();

    const [basicoRes, premiumRes] = await Promise.allSettled([
      fetch('/api/regional/auto/quote-cc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseParams, endoso: endosoBasico }),
      }).then(r => r.json()),
      fetch('/api/regional/auto/quote-cc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseParams, endoso: endosoPlus }),
      }).then(r => r.json()),
    ]);

    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(`[REGIONAL] CC quotes completed in ${elapsed}s`);

    const basicoData = basicoRes.status === 'fulfilled' && basicoRes.value?.success ? basicoRes.value : null;
    const premiumData = premiumRes.status === 'fulfilled' && premiumRes.value?.success ? premiumRes.value : null;

    if (!basicoData && !premiumData) {
      console.warn('[REGIONAL] No se pudieron generar cotizaciones CC');
      return { basico: null, premium: null };
    }

    // Build shared data
    const sharedData = {
      insurerName: 'La Regional de Seguros',
      _isReal: true,
      _isREGIONAL: true,
      _sumaAsegurada: quoteData.valorVehiculo || 0,
      _deducibleOriginal: quoteData.deducible,
      _marcaNombre: quoteData.marca,
      _modeloNombre: quoteData.modelo,
      _marcaCodigo: quoteData.marcaCodigo,
      _modeloCodigo: quoteData.modeloCodigo,
      _anio: quoteData.anio || new Date().getFullYear(),
    };

    // Map user deducible selection to REGIONAL opciones index
    // REGIONAL returns 3 opciones: opcion 1 = bajo (lowest ded), opcion 2 = medio, opcion 3 = alto (highest ded)
    const dedIndexMap: Record<string, number> = { bajo: 0, medio: 1, alto: 2 };
    const selectedDedIndex = dedIndexMap[quoteData.deducible] ?? 0;

    // Standard CC coverages — REGIONAL API returns empty coberturas[] so we provide known coverage list
    const standardCCCoverages = [
      { codigo: 'COMP', nombre: 'Comprensivo', descripcion: 'Cobertura contra robo, hurto, incendio, fenómenos naturales', incluida: true },
      { codigo: 'COLV', nombre: 'Colisión y Vuelco', descripcion: 'Daños por colisión y/o vuelco del vehículo', incluida: true },
      { codigo: 'RC', nombre: 'Responsabilidad Civil', descripcion: 'Daños a terceros: lesiones corporales y daños a propiedad', incluida: true },
      { codigo: 'GM', nombre: 'Gastos Médicos', descripcion: 'Gastos médicos del conductor y pasajeros', incluida: true },
      { codigo: 'AV', nombre: 'Asistencia Vial', descripcion: 'Grúa, cerrajería, paso de corriente, cambio de llanta', incluida: true },
    ];

    // Beneficios by endoso type
    const beneficiosBasico = [
      { nombre: 'Asistencia vial 24/7', descripcion: 'Servicio de grúa, cerrajería, paso de corriente', incluido: true },
      { nombre: 'Cobertura de vidrios', descripcion: 'Reparación o reemplazo de parabrisas', incluido: true },
      { nombre: 'Responsabilidad civil ampliada', descripcion: 'Cobertura de daños a terceros', incluido: true },
    ];
    const beneficiosPlus = [
      ...beneficiosBasico,
      { nombre: 'Auto sustituto', descripcion: 'Vehículo de reemplazo mientras el suyo está en reparación', incluido: true },
      { nombre: 'Accidentes personales', descripcion: 'Cobertura de accidentes para conductor y pasajeros', incluido: true },
      { nombre: 'Extensión territorial', descripcion: 'Cobertura extendida fuera del territorio nacional', incluido: true },
    ];

    // Helper to build a quote object from REGIONAL CC response
    const buildQuote = (data: any, planType: 'basico' | 'premium', endosoNombre: string) => {
      if (!data) return null;

      // REGIONAL returns pricing in opciones array
      const opciones: any[] = Array.isArray(data.opciones) ? data.opciones : [];

      // Select option based on user's deducible preference, fallback to first
      const selectedOption = opciones[selectedDedIndex] || opciones[0] || null;

      if (!selectedOption) {
        console.warn(`[REGIONAL buildQuote ${planType}] No opciones available in response`);
        return null;
      }

      const primaTotal = Number(selectedOption.primaTotal) || 0;
      const dedColision = Number(selectedOption.dedColision) || 0;
      const dedComprensivo = Number(selectedOption.dedComprensivo) || 0;
      const numcot = data.numcot || data.idCotizacion || '';

      console.log(`[REGIONAL buildQuote ${planType}] opcion=${selectedOption.opcion}, primaTotal=${primaTotal}, dedColision=${dedColision}, dedComprensivo=${dedComprensivo}`);

      if (primaTotal <= 0) {
        console.warn(`[REGIONAL buildQuote ${planType}] primaTotal is $0, skipping`);
        return null;
      }

      // Use API coberturas if available, otherwise use standard CC coverages
      const apiCoberturas = (data.coberturas || []).filter((c: any) => c.descripcion || c.nombre);
      const coberturas = apiCoberturas.length > 0
        ? apiCoberturas.map((c: any) => ({
            codigo: c.codigo || c.cod || '',
            nombre: c.descripcion || c.nombre || '',
            descripcion: c.descripcion || c.nombre || '',
            limite: c.limite || c.monto || 'Incluido',
            prima: parseFloat(c.prima) || 0,
            deducible: c.deducible || '',
            incluida: true,
          }))
        : standardCCCoverages;

      const deducibleInfo = {
        valor: dedColision || dedComprensivo,
        tipo: quoteData.deducible || 'bajo',
        descripcion: `Colisión/Vuelco: ${dedColision.toFixed(2)} | Comprensivo: ${dedComprensivo.toFixed(2)}`,
        tooltip: `Colisión/Vuelco: $${dedColision.toFixed(2)}\nComprensivo: $${dedComprensivo.toFixed(2)}`,
      };

      const planBeneficios = planType === 'premium' ? beneficiosPlus : beneficiosBasico;

      // Endosos for this plan
      const endosos = [{
        codigo: endosoNombre.toUpperCase().replace(/\s+/g, '_'),
        nombre: endosoNombre,
        incluido: true,
        descripcion: `Incluido en la prima`,
        subBeneficios: planBeneficios.map(b => b.nombre),
      }];

      // Build all 3 opciones as price options for potential display
      const allOpciones = opciones.map((op: any) => ({
        opcion: op.opcion,
        primaTotal: Number(op.primaTotal) || 0,
        dedColision: Number(op.dedColision) || 0,
        dedComprensivo: Number(op.dedComprensivo) || 0,
      }));

      return {
        ...sharedData,
        id: `regional-${planType}`,
        planType,
        isRecommended: planType === 'premium',
        annualPremium: Math.round(primaTotal * 100) / 100,
        deductible: deducibleInfo.valor,
        coverages: coberturas.map((c: any) => ({ name: c.nombre, included: true })),
        _coberturasDetalladas: coberturas,
        _limites: [],
        _deducibleInfo: deducibleInfo,
        _deduciblesReales: {
          comprensivo: dedComprensivo > 0 ? { amount: dedComprensivo, label: 'Comprensivo' } : null,
          colisionVuelco: dedColision > 0 ? { amount: dedColision, label: 'Colisión/Vuelco' } : null,
        },
        _idCotizacion: numcot,
        _numcot: numcot,
        _opciones: allOpciones,
        _opcionSelec: selectedOption.opcion || 1,
        _priceBreakdown: {
          primaBase: primaTotal,
          descuentoBuenConductor: 0,
          descuentoPorcentaje: 0,
          impuesto: 0,
          totalConTarjeta: primaTotal,
          totalAlContado: primaTotal,
          ahorroContado: 0,
        },
        _beneficios: planBeneficios,
        _endosos: endosos,
        _endosoIncluido: endosoNombre,
        _endosoTexto: endosoNombre.toUpperCase(),
      };
    };

    const basico = buildQuote(basicoData, 'basico', 'Endoso Básico');
    const premium = buildQuote(premiumData, 'premium', 'Endoso Plus');

    if (basico) console.log(`[REGIONAL] ✅ Básico: $${basico.annualPremium}`);
    if (premium) console.log(`[REGIONAL] ✅ Premium: $${premium.annualPremium}`);

    return { basico, premium };
  } catch (error) {
    console.error('[REGIONAL] Error generando cotización CC:', error);
    return { basico: null, premium: null };
  }
};

/**
 * Genera cotización REAL con ANCÓN usando las APIs
 * Básico = opcion1 (limits bajos), Premium = opcion3 (limits altos)
 * Deducibles: a=bajo, b=medio, c=alto
 */
const generateAnconQuotes = async (quoteData: any): Promise<{ basico: any | null; premium: any | null }> => {
  try {
    console.log('[ANCON] Cotizando CC...');
    const t0 = performance.now();

    const cotResponse = await fetch('/api/ancon/cotizacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // IS numeric codes are included but the API will prefer name-based resolution
        cod_marca: quoteData.marcaCodigo || '00122',
        cod_modelo: quoteData.modeloCodigo || '10393',
        // Brand/model name strings — used by the API to resolve correct ANCON codes
        marca: quoteData.marca || '',
        modelo: quoteData.modelo || '',
        ano: String(quoteData.anio || new Date().getFullYear()),
        suma_asegurada: String(quoteData.valorVehiculo || 15000),
        cod_producto: '00312',
        cedula: quoteData.cedula || '8-888-9999',
        nombre: (quoteData.nombre || quoteData.primerNombre || 'COTIZACION').toUpperCase(),
        apellido: (quoteData.apellido || quoteData.primerApellido || 'WEB').toUpperCase(),
        vigencia: 'A',
        email: quoteData.email || 'cotizacion@lideresenseguros.com',
        tipo_persona: 'N',
        fecha_nac: quoteData.fechaNacimiento
          ? new Date(quoteData.fechaNacimiento).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : '16/06/1994',
        nuevo: quoteData.vehiculoNuevo ? '1' : '0',
      }),
    });

    const cotData = await cotResponse.json();
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(`[ANCON] CC quote completed in ${elapsed}s`);

    if (!cotData.success || !cotData.options || cotData.options.length === 0) {
      console.warn('[ANCON] No se pudieron generar cotizaciones CC:', cotData.error);
      return { basico: null, premium: null };
    }

    const options = cotData.options;
    // Map deducible selection to a/b/c suffix
    const dedMap: Record<string, 'A' | 'B' | 'C'> = { bajo: 'A', medio: 'B', alto: 'C' };
    const dedSuffix = dedMap[quoteData.deducible] || 'A';

    const sharedData = {
      insurerName: 'ANCÓN Seguros',
      _isReal: true,
      _isANCON: true,
      _sumaAsegurada: quoteData.valorVehiculo || 0,
      _deducibleOriginal: quoteData.deducible,
      _marcaNombre: quoteData.marca,
      _modeloNombre: quoteData.modelo,
      _anio: quoteData.anio || new Date().getFullYear(),
    };

    const buildQuote = (option: any, planType: 'basico' | 'premium', endosoNombre: string) => {
      if (!option) return null;

      // Select the right deducible level
      const totalKey = `total${dedSuffix}` as 'totalA' | 'totalB' | 'totalC';
      const primaTotal = option.totals?.[totalKey] || option.totals?.totalA || 0;

      // ═══ NORMALIZE COVERAGE NAMES ═══
      // Map raw Ancón names to standard names matching other insurers
      const COVERAGE_NAME_MAP: Record<string, { name: string; emoji: string }> = {
        'COMPRENSIVO': { name: 'Comprensivo', emoji: '🔥' },
        'COLISION O VUELCO': { name: 'Colisión y Vuelco', emoji: '💥' },
        'COLISION Y VUELCO': { name: 'Colisión y Vuelco', emoji: '💥' },
        'R.C. LESIONES CORPORALES': { name: 'Lesiones Corporales (RC)', emoji: '🩹' },
        'LESIONES CORPORALES': { name: 'Lesiones Corporales (RC)', emoji: '🩹' },
        'R.C. DAÑOS A LA PROPIEDAD': { name: 'Daños a la Propiedad (RC)', emoji: '🚗💥' },
        'DAÑOS A LA PROPIEDAD AJENA': { name: 'Daños a la Propiedad (RC)', emoji: '🚗💥' },
        'DAÑOS A LA PROPIEDAD': { name: 'Daños a la Propiedad (RC)', emoji: '🚗💥' },
        'ASISTENCIA MEDICA': { name: 'Gastos Médicos', emoji: '🏥' },
        'GASTOS MEDICOS': { name: 'Gastos Médicos', emoji: '🏥' },
        'GASTOS MÉDICOS': { name: 'Gastos Médicos', emoji: '🏥' },
        'MUERTE ACCIDENTAL': { name: 'Muerte Accidental', emoji: '🛡️' },
        'ACCIDENTES PERSONALES': { name: 'Accidentes Personales', emoji: '👥' },
        'AUTO SUSTITUTO': { name: 'Auto Sustituto', emoji: '🚗' },
        'ASISTENCIA VIAL': { name: 'Asistencia Vial', emoji: '🔧' },
        'GRUA': { name: 'Grúa', emoji: '🚛' },
        'EXTENSION TERRITORIAL': { name: 'Extensión Territorial', emoji: '🌎' },
      };

      const normalizeName = (rawName: string): { name: string; emoji: string } => {
        const upper = (rawName || '').toUpperCase().trim();
        // Exact match first
        if (COVERAGE_NAME_MAP[upper]) return COVERAGE_NAME_MAP[upper];
        // Partial match
        for (const [key, val] of Object.entries(COVERAGE_NAME_MAP)) {
          if (upper.includes(key) || key.includes(upper)) return val;
        }
        return { name: rawName, emoji: '✦' };
      };

      // ═══ FORMAT LIMIT: combine limite1 + limite2 into "per-person / per-event" ═══
      const formatAnconLimit = (c: any): string => {
        const lim1 = c.limite1 && c.limite1 !== '0.00' && c.limite1 !== '0' ? c.limite1 : null;
        const lim2 = c.limite2 && c.limite2 !== '0.00' && c.limite2 !== '0' ? c.limite2 : null;
        if (lim1 && lim2) {
          // Dual limit: e.g., "5000.00" + "10000.00" → "$5,000 / $10,000"
          const fmt1 = `$${Number(lim1).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          const fmt2 = `$${Number(lim2).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          return `${fmt1} / ${fmt2}`;
        }
        if (lim1) {
          return `$${Number(lim1).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
        return 'INCLUIDO';
      };

      // Build coverage list with normalized names and combined limits
      const coverageList = (option.coverages || []).map((c: any) => {
        const primaKey = `prima${dedSuffix}` as 'primaA' | 'primaB' | 'primaC';
        const dedKeyFull = `deducible${dedSuffix}` as 'deducibleA' | 'deducibleB' | 'deducibleC';
        const normalized = normalizeName(c.name);
        return {
          code: c.name?.substring(0, 3)?.toUpperCase() || '',
          name: normalized.name,
          rawName: c.name || '',
          emoji: normalized.emoji,
          limit: formatAnconLimit(c),
          prima: c[primaKey] || 0,
          deducible: c[dedKeyFull] || 0,
        };
      });

      // ═══ ENDOSO BENEFITS — Detailed with grúa info, emojis ═══
      const endosoBenefits: string[] = [];
      const isPremium = planType === 'premium';

      // Grúa details
      const hasGrua = coverageList.some((c: any) => c.rawName?.toUpperCase()?.includes('GRUA'));
      if (hasGrua || isPremium) {
        endosoBenefits.push('🚛 Grúa: Por colisión y avería — Máx. 2 eventos/año, hasta B/.150 por evento');
      } else {
        endosoBenefits.push('🚛 Grúa: Solo por colisión — Máx. 1 evento/año, hasta B/.100 por evento');
      }

      // Asistencia Vial
      const hasAsistVial = coverageList.some((c: any) => c.rawName?.toUpperCase()?.includes('ASISTENCIA VIAL'));
      if (hasAsistVial || isPremium) {
        endosoBenefits.push('🔧 Asistencia Vial: Paso de corriente, cambio de llanta, cerrajería, combustible');
      }

      // Auto Sustituto
      const hasAutoSustituto = coverageList.some((c: any) => c.rawName?.toUpperCase()?.includes('AUTO SUSTITUTO'));
      if (hasAutoSustituto) {
        endosoBenefits.push('🚗 Auto Sustituto: Reembolso para auto de reemplazo ANCON Plus');
      }

      // Standard benefits
      endosoBenefits.push('🚑 Ambulancia: Coordinación de envío por accidente de tránsito');
      endosoBenefits.push('📋 Transmisión de mensajes urgentes a familiares');
      if (isPremium) {
        endosoBenefits.push('⚖️ Asistencia Legal: Asesoría en accidentes de tránsito');
        endosoBenefits.push('🌎 Extensión Territorial: Cobertura fuera del territorio nacional');
      }

      // Build deducibles array from CC coverages
      const deducibles = coverageList
        .filter((c: any) => c.deducible > 0)
        .map((c: any) => ({
          cobertura: c.name,
          monto: c.deducible,
          formato: `$${Number(c.deducible).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        }));

      const annualPremium = Math.round(primaTotal * 100) / 100;

      // Extract comprensivo + colision deducibles for display
      const dedComprensivo = coverageList.find((c: any) => c.rawName?.toUpperCase()?.includes('COMPRENSIV'));
      const dedColision = coverageList.find((c: any) => c.rawName?.toUpperCase()?.includes('COLISI') || c.rawName?.toUpperCase()?.includes('VUELCO'));
      const minDeductible = deducibles.length > 0
        ? Math.min(...deducibles.map((d: any) => Number(d.monto) || 0))
        : 0;

      // Build beneficios list with emojis
      const anconBeneficios = [
        ...endosoBenefits.map((b: string) => ({ nombre: b, descripcion: b, incluido: true })),
      ];

      // Build endosos
      const anconEndosos = [{
        codigo: endosoNombre.toUpperCase().replace(/\s+/g, '_'),
        nombre: endosoNombre,
        incluido: true,
        descripcion: 'Incluido en la prima',
        subBeneficios: endosoBenefits,
      }];

      // Build coberturas detalladas with emoji prefix and normalized names
      const coberturasDetalladas = coverageList.map((c: any) => ({
        codigo: c.code || '',
        nombre: `${c.emoji} ${c.name}`,
        descripcion: c.name || '',
        limite: c.limit || 'Incluido',
        prima: c.prima || 0,
        deducible: c.deducible ? `$${Number(c.deducible).toFixed(2)}` : '',
        incluida: true,
      }));

      // Build _limites array for RC coverages (consistent with IS/FEDPA)
      const anconLimites: any[] = [];
      const lesionesItem = coverageList.find((c: any) => c.rawName?.toUpperCase()?.includes('LESIONES'));
      if (lesionesItem) {
        const parts = lesionesItem.limit?.split('/') || [];
        anconLimites.push({
          tipo: 'lesiones_corporales',
          limitePorPersona: parts[0]?.trim() || lesionesItem.limit || '',
          limitePorAccidente: parts[1]?.trim() || '',
          descripcion: 'Lesiones Corporales',
        });
      }
      const propiedadItem = coverageList.find((c: any) => c.rawName?.toUpperCase()?.includes('PROPIEDAD') || c.rawName?.toUpperCase()?.includes('DAÑOS'));
      if (propiedadItem) {
        anconLimites.push({
          tipo: 'daños_propiedad',
          limitePorPersona: propiedadItem.limit || '',
          descripcion: 'Daños a la Propiedad',
        });
      }
      const gmItem = coverageList.find((c: any) => c.rawName?.toUpperCase()?.includes('ASISTENCIA MEDICA') || c.rawName?.toUpperCase()?.includes('GASTOS MED'));
      if (gmItem) {
        const gmParts = gmItem.limit?.split('/') || [];
        anconLimites.push({
          tipo: 'gastos_medicos',
          limitePorPersona: gmParts[0]?.trim() || gmItem.limit || '',
          limitePorAccidente: gmParts[1]?.trim() || '',
          descripcion: 'Gastos Médicos',
        });
      }

      const deducibleInfo = {
        valor: minDeductible,
        tipo: quoteData.deducible || 'bajo',
        descripcion: dedComprensivo || dedColision
          ? `Colisión/Vuelco: $${Number(dedColision?.deducible || 0).toFixed(2)} | Comprensivo: $${Number(dedComprensivo?.deducible || 0).toFixed(2)}`
          : `Deducible desde $${minDeductible.toFixed(2)}`,
        tooltip: dedComprensivo || dedColision
          ? `Colisión/Vuelco: $${Number(dedColision?.deducible || 0).toFixed(2)}\nComprensivo: $${Number(dedComprensivo?.deducible || 0).toFixed(2)}`
          : `Deducible: $${minDeductible.toFixed(2)}`,
      };

      return {
        ...sharedData,
        id: `ancon-${planType}`,
        planType,
        isRecommended: planType === 'premium',
        annualPremium,
        deductible: minDeductible,
        coverages: coverageList.map((c: any) => ({ name: c.name, included: true })),
        coverageList,
        endosoBenefits,
        endosoNombre,
        deducibles,
        _priceBreakdown: {
          primaBase: annualPremium,
          descuentoBuenConductor: 0,
          descuentoPorcentaje: 0,
          impuesto: 0,
          totalConTarjeta: annualPremium,
          totalAlContado: annualPremium,
          ahorroContado: 0,
        },
        _deduciblesReales: {
          comprensivo: dedComprensivo && Number(dedComprensivo.deducible) > 0
            ? { amount: Number(dedComprensivo.deducible), label: 'Comprensivo' } : null,
          colisionVuelco: dedColision && Number(dedColision.deducible) > 0
            ? { amount: Number(dedColision.deducible), label: 'Colisión/Vuelco' } : null,
        },
        _coberturasDetalladas: coberturasDetalladas,
        _limites: anconLimites,
        _deducibleInfo: deducibleInfo,
        _beneficios: anconBeneficios,
        _endosos: anconEndosos,
        _endosoIncluido: endosoNombre,
        _endosoTexto: endosoNombre.toUpperCase(),
        _idCotizacion: option.noCotizacion || cotData.noCotizacion,
        _optionName: option.name,
        _opcion: dedSuffix,
        _codProducto: planType === 'premium' ? '10602' : '00312',
        _nombreProducto: planType === 'premium' ? 'EXTRA PLUS 2024' : 'AUTO COMPLETA',
      };
    };

    // opcion1 = basic limits, opcion3 = premium limits
    const basicOption = options.find((o: any) => o.name === 'opcion1');
    const premiumOption = options.find((o: any) => o.name === 'opcion3') || options.find((o: any) => o.name === 'opcion2');

    const basico = buildQuote(basicOption, 'basico', 'Endoso Básico ANCON');
    const premium = buildQuote(premiumOption, 'premium', 'Endoso Premium ANCON Plus');

    if (basico) console.log(`[ANCON] ✅ Básico: $${basico.annualPremium}`);
    if (premium) console.log(`[ANCON] ✅ Premium: $${premium.annualPremium}`);

    return { basico, premium };
  } catch (error) {
    console.error('[ANCON] Error generando cotización CC:', error);
    return { basico: null, premium: null };
  }
};

export default function ComparePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [offlineInsurers, setOfflineInsurers] = useState<string[]>([]);
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
          
          // ── PARALELO: IS, FEDPA, REGIONAL y ANCON al mismo tiempo ──
          console.log('[Comparar] Generando cotizaciones en PARALELO (IS + FEDPA + REGIONAL + ANCON)...');
          const t0 = Date.now();
          
          const [isResult, fedpaResult, regionalResult, anconResult] = await Promise.allSettled([
            generateInternacionalQuotes(input),
            generateFedpaQuotes(input),
            generateRegionalQuotes(input),
            generateAnconQuotes(input),
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
          
          // Procesar resultado REGIONAL
          if (regionalResult.status === 'fulfilled') {
            const regionalQuotes = regionalResult.value;
            if (regionalQuotes.premium) {
              realQuotes.push(regionalQuotes.premium);
              console.log('[REGIONAL] ✅ Premium:', regionalQuotes.premium.annualPremium);
            }
            if (regionalQuotes.basico) {
              realQuotes.push(regionalQuotes.basico);
              console.log('[REGIONAL] ✅ Básico:', regionalQuotes.basico.annualPremium);
            }
            if (!regionalQuotes.premium && !regionalQuotes.basico) {
              console.warn('[REGIONAL] ⚠️ No se pudieron generar cotizaciones CC');
            }
            // ═══ ADM COT: Track REGIONAL quotes ═══
            const regionalRef = regionalQuotes.premium?._idCotizacion || regionalQuotes.basico?._idCotizacion;
            if (regionalRef) {
              const trackBase = {
                clientName: input.nombreCompleto || 'Anónimo',
                cedula: input.cedula,
                email: input.email,
                phone: input.telefono,
                ramo: 'AUTO',
                coverageType: 'Cobertura Completa',
                vehicleInfo: { marca: input.marca, modelo: input.modelo, anio: input.anio, valor: input.valorVehiculo },
              };
              if (regionalQuotes.premium) {
                trackQuoteCreated({ ...trackBase, quoteRef: `REGIONAL-${regionalRef}-P`, insurer: 'REGIONAL', planName: 'Premium (Endoso Plus)', annualPremium: regionalQuotes.premium.annualPremium });
              }
              if (regionalQuotes.basico) {
                trackQuoteCreated({ ...trackBase, quoteRef: `REGIONAL-${regionalRef}-B`, insurer: 'REGIONAL', planName: 'Básico (Endoso Básico)', annualPremium: regionalQuotes.basico.annualPremium });
              }
            }
          } else {
            console.error('[REGIONAL] Error obteniendo cotizaciones:', regionalResult.reason);
            toast.error('Error al obtener cotizaciones de REGIONAL');
          }
          
          // Procesar resultado ANCON
          if (anconResult.status === 'fulfilled') {
            const anconQuotes = anconResult.value;
            if (anconQuotes.premium) {
              realQuotes.push(anconQuotes.premium);
              console.log('[ANCON] ✅ Premium:', anconQuotes.premium.annualPremium);
            }
            if (anconQuotes.basico) {
              realQuotes.push(anconQuotes.basico);
              console.log('[ANCON] ✅ Básico:', anconQuotes.basico.annualPremium);
            }
            if (!anconQuotes.premium && !anconQuotes.basico) {
              console.warn('[ANCON] ⚠️ No se pudieron generar cotizaciones CC');
            }
            // ═══ ADM COT: Track ANCON quotes ═══
            const anconRef = anconQuotes.premium?._idCotizacion || anconQuotes.basico?._idCotizacion;
            if (anconRef) {
              const trackBase = {
                clientName: input.nombreCompleto || 'Anónimo',
                cedula: input.cedula,
                email: input.email,
                phone: input.telefono,
                ramo: 'AUTO',
                coverageType: 'Cobertura Completa',
                vehicleInfo: { marca: input.marca, modelo: input.modelo, anio: input.anio, valor: input.valorVehiculo },
              };
              if (anconQuotes.premium) {
                trackQuoteCreated({ ...trackBase, quoteRef: `ANCON-${anconRef}-P`, insurer: 'ANCON', planName: 'Premium (ANCON Plus)', annualPremium: anconQuotes.premium.annualPremium });
              }
              if (anconQuotes.basico) {
                trackQuoteCreated({ ...trackBase, quoteRef: `ANCON-${anconRef}-B`, insurer: 'ANCON', planName: 'Básico', annualPremium: anconQuotes.basico.annualPremium });
              }
            }
          } else {
            console.error('[ANCON] Error obteniendo cotizaciones:', anconResult.reason);
            toast.error('Error al obtener cotizaciones de ANCON');
          }

          // Track offline insurers for UI
          const offline: string[] = [];
          const hasIS = realQuotes.some(q => q.insurerName?.includes('INTERNACIONAL'));
          const hasFEDPA = realQuotes.some(q => q.insurerName?.includes('FEDPA'));
          const hasREGIONAL = realQuotes.some(q => q.insurerName?.includes('Regional'));
          const hasANCON = realQuotes.some(q => q.insurerName?.includes('ANCÓN') || q.insurerName?.includes('Ancon'));
          if (!hasIS) offline.push('INTERNACIONAL de Seguros');
          if (!hasFEDPA) offline.push('FEDPA Seguros');
          if (!hasREGIONAL) offline.push('La Regional de Seguros');
          if (!hasANCON) offline.push('ANCÓN Seguros');
          setOfflineInsurers(offline);

          if (realQuotes.length > 0) {
            setQuotes(realQuotes);
            if (offline.length > 0) {
              toast.warning(`${offline.length} aseguradora(s) no disponible(s): ${offline.join(', ')}`);
            }
            toast.success(`${realQuotes.length} cotización(es) generada(s)`);
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
          offlineInsurers={offlineInsurers}
        />
      </div>
    </div>
  );
}
