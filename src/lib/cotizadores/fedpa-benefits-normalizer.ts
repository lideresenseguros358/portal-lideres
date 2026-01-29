/**
 * Normalizador de Beneficios FEDPA
 * Extrae cantidades exactas de beneficios (grúa, gasolina, cerrajero, etc)
 * y calcula desglose con descuento buen conductor
 */

export interface FedpaBenefit {
  key: string;
  label: string;
  qty?: number;
  unit?: string;
  limit?: string;
  tooltip?: string;
  included: boolean;
  isPremiumOnly?: boolean;
}

export interface FedpaDeductibleInfo {
  nivel: 'bajo' | 'medio' | 'alto';
  montoColision?: number;
  montoComprensivo?: number;
  descripcion: string;
  tooltip?: string;
}

export interface FedpaPriceBreakdown {
  primaBaseSinImpuesto: number;
  descuentoBuenConductor: number;
  impuesto: number;
  totalAnualTarjeta: number;
  totalAlContado?: number;
  ahorroContado?: number;
}

/**
 * Normaliza beneficios desde respuesta FEDPA
 * Extrae cantidades de eventos, límites de km, montos, etc.
 */
export function normalizeFedpaBenefits(
  beneficiosResponse: any[],
  planType: 'basico' | 'premium'
): FedpaBenefit[] {
  const benefits: FedpaBenefit[] = [];

  // Recorrer beneficios y extraer cantidades
  for (const beneficio of beneficiosResponse) {
    const text = (beneficio.beneficio || '').toUpperCase();
    
    // GRÚA / REMOLQUE
    if (text.includes('GRUA') || text.includes('REMOLQUE')) {
      const eventosMatch = text.match(/(\d+)\s*EVENTO/i);
      const kmMatch = text.match(/(\d+)\s*KM/i);
      const montoMatch = text.match(/B\/\.?\s*(\d+)/i);
      
      benefits.push({
        key: 'asistencia_grua',
        label: 'Servicio de grúa',
        qty: eventosMatch ? parseInt(eventosMatch[1]) : 2,
        unit: 'eventos/año',
        limit: kmMatch 
          ? `Hasta ${kmMatch[1]} km` 
          : montoMatch 
            ? `Hasta B/. ${montoMatch[1]}` 
            : 'Ver póliza',
        tooltip: 'Remolque en caso de avería o accidente',
        included: true,
      });
    }
    
    // PASO DE CORRIENTE
    if (text.includes('PASO DE CORRIENTE') || text.includes('BATERIA')) {
      const eventosMatch = text.match(/(\d+)\s*EVENTO/i);
      
      benefits.push({
        key: 'paso_corriente',
        label: 'Paso de corriente',
        qty: eventosMatch ? parseInt(eventosMatch[1]) : undefined,
        unit: eventosMatch ? 'eventos/año' : undefined,
        tooltip: 'Asistencia si tu batería se descarga',
        included: true,
      });
    }
    
    // GASOLINA / COMBUSTIBLE
    if (text.includes('GASOLINA') || text.includes('COMBUSTIBLE')) {
      const eventosMatch = text.match(/(\d+)\s*EVENTO/i);
      const galMatch = text.match(/(\d+)\s*GAL/i);
      
      benefits.push({
        key: 'suministro_gasolina',
        label: 'Suministro de gasolina',
        qty: eventosMatch ? parseInt(eventosMatch[1]) : undefined,
        unit: eventosMatch ? 'eventos/año' : undefined,
        limit: galMatch ? `Hasta ${galMatch[1]} galones` : undefined,
        tooltip: 'Suministro de emergencia si te quedas sin combustible',
        included: true,
      });
    }
    
    // CERRAJERO
    if (text.includes('CERRAJERO') || text.includes('LLAVES')) {
      const eventosMatch = text.match(/(\d+)\s*EVENTO/i);
      
      benefits.push({
        key: 'cerrajero',
        label: 'Cerrajero',
        qty: eventosMatch ? parseInt(eventosMatch[1]) : undefined,
        unit: eventosMatch ? 'eventos/año' : undefined,
        tooltip: 'Ayuda si pierdes las llaves o te encierras',
        included: true,
      });
    }
    
    // AMBULANCIA
    if (text.includes('AMBULANCIA')) {
      const eventosMatch = text.match(/(\d+)\s*EVENTO/i);
      const montoMatch = text.match(/B\/\.?\s*(\d+)/i);
      
      benefits.push({
        key: 'ambulancia',
        label: 'Ambulancia por accidente',
        qty: eventosMatch ? parseInt(eventosMatch[1]) : undefined,
        unit: eventosMatch ? 'eventos/año' : 'Sin límite',
        limit: montoMatch ? `Máximo B/. ${montoMatch[1]}/año` : undefined,
        tooltip: 'Servicio de ambulancia en caso de accidente',
        included: true,
      });
    }
    
    // ASISTENCIA LEGAL
    if (text.includes('ASISTENCIA LEGAL') || text.includes('DEFENSA PENAL')) {
      const montoMatch = text.match(/B\/\.?\s*(\d+,?\d*)/i);
      
      benefits.push({
        key: 'asistencia_legal',
        label: 'Asistencia legal',
        limit: montoMatch ? `Hasta B/. ${montoMatch[1].replace(',', '')}` : undefined,
        tooltip: 'Asesoría legal en caso de accidente',
        included: true,
        isPremiumOnly: planType === 'premium',
      });
    }
    
    // AUTO DE ALQUILER / REEMPLAZO
    if (text.includes('AUTO DE ALQUILER') || text.includes('VEHICULO DE REEMPLAZO')) {
      const diasMatch = text.match(/(\d+)\s*DIA/i);
      
      benefits.push({
        key: 'auto_alquiler',
        label: 'Vehículo de reemplazo',
        qty: diasMatch ? parseInt(diasMatch[1]) : undefined,
        unit: diasMatch ? 'días' : undefined,
        tooltip: 'Auto de alquiler mientras el tuyo está en reparación',
        included: true,
        isPremiumOnly: planType === 'premium',
      });
    }
    
    // MUERTE ACCIDENTAL
    if (text.includes('MUERTE ACCIDENTAL')) {
      const montoMatch = text.match(/B\/\.?\s*(\d+,?\d*)/i);
      
      benefits.push({
        key: 'muerte_accidental',
        label: 'Muerte accidental conductor',
        limit: montoMatch ? `B/. ${montoMatch[1].replace(',', '')}` : undefined,
        tooltip: 'Indemnización en caso de fallecimiento por accidente',
        included: true,
      });
    }
    
    // ASISTENCIA MÉDICA TELEFÓNICA
    if (text.includes('ASISTENCIA MÉDICA') || text.includes('MEDICA TELEFONICA')) {
      benefits.push({
        key: 'asistencia_medica',
        label: 'Asistencia médica telefónica',
        unit: '24/7',
        tooltip: 'Consulta médica telefónica las 24 horas',
        included: true,
      });
    }
  }
  
  // Eliminar duplicados por key
  const uniqueBenefits = benefits.filter((benefit, index, self) =>
    index === self.findIndex((b) => b.key === benefit.key)
  );
  
  return uniqueBenefits;
}

/**
 * Extrae información de deducible desde coberturas
 */
export function extractDeductibleInfo(
  coberturas: any[],
  nivel: 'bajo' | 'medio' | 'alto'
): FedpaDeductibleInfo {
  // Buscar coberturas con deducible
  const coberturaComprensivo = coberturas.find((c: any) => 
    c.COBERTURA === 'D' || c.DESCCOBERTURA?.toUpperCase().includes('COMPRENSIVO')
  );
  
  const coberturaColision = coberturas.find((c: any) => 
    c.COBERTURA === 'E' || c.DESCCOBERTURA?.toUpperCase().includes('COLISION')
  );
  
  const deducibleComprensivo = coberturaComprensivo?.DEDUCIBLE || 0;
  const deducibleColision = coberturaColision?.DEDUCIBLE || 0;
  
  let descripcion = '';
  let tooltip = '';
  
  if (deducibleColision > 0 || deducibleComprensivo > 0) {
    descripcion = `Deducible ${nivel}`;
    if (deducibleColision > 0) {
      descripcion += `: Colisión B/. ${deducibleColision.toFixed(2)}`;
    }
    if (deducibleComprensivo > 0 && deducibleComprensivo !== deducibleColision) {
      descripcion += ` | Comprensivo B/. ${deducibleComprensivo.toFixed(2)}`;
    }
  } else {
    descripcion = `Deducible ${nivel}`;
    tooltip = 'El monto exacto se confirmará al emitir. Puede variar según plan y valor del vehículo.';
  }
  
  return {
    nivel,
    montoColision: deducibleColision > 0 ? deducibleColision : undefined,
    montoComprensivo: deducibleComprensivo > 0 ? deducibleComprensivo : undefined,
    descripcion,
    tooltip,
  };
}

/**
 * Calcula desglose de tarifa con descuento buen conductor
 * FEDPA no devuelve descuento explícito, debemos calcularlo
 */
export function calculateFedpaPriceBreakdown(
  primaTotal: number,
  primaBase: number,
  impuesto1: number,
  impuesto2: number,
  totalContado?: number
): FedpaPriceBreakdown {
  // Total impuesto
  const totalImpuesto = impuesto1 + impuesto2;
  
  // Total anual con tarjeta (prima total)
  const totalAnualTarjeta = primaTotal;
  
  // Prima base SIN impuesto (teórica antes de descuentos)
  const primaBaseSinImpuesto = primaBase || (totalAnualTarjeta - totalImpuesto);
  
  // Calcular descuento buen conductor (diferencia entre prima base teórica y neta)
  // Descuento = Prima base teórica - (Total tarjeta - Impuesto)
  const totalNetoSinImpuesto = totalAnualTarjeta - totalImpuesto;
  let descuentoBuenConductor = primaBaseSinImpuesto - totalNetoSinImpuesto;
  
  // Validación: descuento no puede ser negativo
  if (descuentoBuenConductor < 0) {
    console.warn('[FEDPA Price] Descuento calculado negativo:', descuentoBuenConductor, 'ajustando a 0');
    descuentoBuenConductor = 0;
  }
  
  // Ahorro al contado
  const ahorroContado = totalContado ? totalAnualTarjeta - totalContado : undefined;
  
  return {
    primaBaseSinImpuesto,
    descuentoBuenConductor,
    impuesto: totalImpuesto,
    totalAnualTarjeta,
    totalAlContado: totalContado,
    ahorroContado,
  };
}
