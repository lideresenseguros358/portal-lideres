/**
 * Normalizador de Beneficios FEDPA
 * Extrae asistencias, deducibles y descuentos de planes
 */

// ============================================
// TIPOS
// ============================================

export interface AsistenciaBeneficio {
  label: string;
  qty?: number; // Cantidad (eventos al año)
  maxAmount?: number; // Monto máximo por evento
  maxKm?: number; // Kilómetros máximo (grúa)
  unit?: string; // galones, eventos, etc.
  rawText: string; // Texto original
}

export interface DeducibleInfo {
  comprensivo: {
    amount: number;
    currency: string;
    source: string;
  } | null;
  colisionVuelco: {
    amount: number;
    currency: string;
    source: string;
  } | null;
}

export interface DescuentoBuenConductor {
  primaBase: number;
  totalTarjeta: number;
  impuesto: number;
  descuento: number;
  porcentaje: number;
}

// ============================================
// NORMALIZAR ASISTENCIAS
// ============================================

/**
 * Extrae servicios de asistencia con cantidades y montos
 */
export function normalizeAssistanceBenefits(
  beneficios: any[]
): AsistenciaBeneficio[] {
  const asistencias: AsistenciaBeneficio[] = [];
  
  if (!beneficios || !Array.isArray(beneficios)) {
    return asistencias;
  }
  
  for (const beneficio of beneficios) {
    const descripcion = beneficio.descripcion || beneficio.nombre || beneficio.servicio || '';
    const texto = descripcion.toLowerCase();
    
    // GRÚA / REMOLQUE
    if (texto.includes('grúa') || texto.includes('remolque')) {
      const item: AsistenciaBeneficio = {
        label: 'Grúa / Remolque',
        rawText: descripcion,
      };
      
      // Extraer cantidad (eventos)
      const qtyMatch = descripcion.match(/(\d+)\s*(eventos?|servicios?|veces)/i);
      if (qtyMatch) {
        item.qty = parseInt(qtyMatch[1]);
        item.unit = 'eventos/año';
      }
      
      // Extraer monto máximo
      const amountMatch = descripcion.match(/B\/?\.\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i) ||
                          descripcion.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i) ||
                          descripcion.match(/hasta\s+(\d+)/i);
      if (amountMatch) {
        item.maxAmount = parseFloat(amountMatch[1].replace(',', ''));
      }
      
      // Extraer kilómetros
      const kmMatch = descripcion.match(/(\d+)\s*km/i);
      if (kmMatch) {
        item.maxKm = parseInt(kmMatch[1]);
      }
      
      asistencias.push(item);
    }
    
    // PASO DE CORRIENTE
    else if (texto.includes('paso de corriente') || texto.includes('batería')) {
      const item: AsistenciaBeneficio = {
        label: 'Paso de Corriente',
        rawText: descripcion,
      };
      
      const qtyMatch = descripcion.match(/(\d+)\s*(eventos?|servicios?|veces)/i);
      if (qtyMatch) {
        item.qty = parseInt(qtyMatch[1]);
        item.unit = 'eventos/año';
      }
      
      asistencias.push(item);
    }
    
    // SUMINISTRO GASOLINA
    else if (texto.includes('gasolina') || texto.includes('combustible')) {
      const item: AsistenciaBeneficio = {
        label: 'Suministro de Gasolina',
        rawText: descripcion,
      };
      
      const qtyMatch = descripcion.match(/(\d+)\s*(eventos?|servicios?|veces)/i);
      if (qtyMatch) {
        item.qty = parseInt(qtyMatch[1]);
        item.unit = 'eventos/año';
      }
      
      // Extraer galones
      const galonMatch = descripcion.match(/(\d+)\s*galones?/i);
      if (galonMatch) {
        item.maxAmount = parseInt(galonMatch[1]);
        item.unit = 'galones';
      }
      
      asistencias.push(item);
    }
    
    // CERRAJERO
    else if (texto.includes('cerrajero') || texto.includes('llave')) {
      const item: AsistenciaBeneficio = {
        label: 'Cerrajero',
        rawText: descripcion,
      };
      
      const qtyMatch = descripcion.match(/(\d+)\s*(eventos?|servicios?|veces)/i);
      if (qtyMatch) {
        item.qty = parseInt(qtyMatch[1]);
        item.unit = 'eventos/año';
      }
      
      const amountMatch = descripcion.match(/B\/?\.\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i) ||
                          descripcion.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
      if (amountMatch) {
        item.maxAmount = parseFloat(amountMatch[1].replace(',', ''));
      }
      
      asistencias.push(item);
    }
    
    // CAMBIO DE LLANTA / ASISTENCIA VIAL
    else if (texto.includes('llanta') || texto.includes('neumático') || 
             (texto.includes('asistencia') && texto.includes('vial'))) {
      const item: AsistenciaBeneficio = {
        label: 'Cambio de Llanta / Asistencia Vial',
        rawText: descripcion,
      };
      
      const qtyMatch = descripcion.match(/(\d+)\s*(eventos?|servicios?|veces)/i);
      if (qtyMatch) {
        item.qty = parseInt(qtyMatch[1]);
        item.unit = 'eventos/año';
      }
      
      asistencias.push(item);
    }
    
    // ASISTENCIA MÉDICA / AMBULANCIA
    else if (texto.includes('médica') || texto.includes('ambulancia') || texto.includes('salud')) {
      const item: AsistenciaBeneficio = {
        label: 'Asistencia Médica',
        rawText: descripcion,
      };
      
      // Si dice 24/7 o ilimitado
      if (texto.includes('24') || texto.includes('ilimitado')) {
        item.unit = '24/7';
      }
      
      asistencias.push(item);
    }
  }
  
  return asistencias;
}

// ============================================
// NORMALIZAR DEDUCIBLES
// ============================================

/**
 * Extrae deducibles reales de beneficios o coberturas
 */
export function normalizeDeductibles(
  beneficios: any[],
  coberturas?: any[],
  seleccionUsuario?: 'bajo' | 'medio' | 'alto'
): DeducibleInfo {
  const result: DeducibleInfo = {
    comprensivo: null,
    colisionVuelco: null,
  };
  
  // Fuente 1: Beneficios
  if (beneficios && Array.isArray(beneficios)) {
    for (const ben of beneficios) {
      const desc = (ben.descripcion || ben.nombre || '').toLowerCase();
      
      if (desc.includes('deducible') && desc.includes('comprensiv')) {
        const match = desc.match(/B\/?\.\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i) ||
                      desc.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i) ||
                      desc.match(/(\d+)/);
        if (match) {
          result.comprensivo = {
            amount: parseFloat(match[1].replace(',', '')),
            currency: 'B/.',
            source: 'beneficios',
          };
        }
      }
      
      if (desc.includes('deducible') && (desc.includes('colisión') || desc.includes('vuelco'))) {
        const match = desc.match(/B\/?\.\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i) ||
                      desc.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i) ||
                      desc.match(/(\d+)/);
        if (match) {
          result.colisionVuelco = {
            amount: parseFloat(match[1].replace(',', '')),
            currency: 'B/.',
            source: 'beneficios',
          };
        }
      }
    }
  }
  
  // Fuente 2: Coberturas
  if (coberturas && Array.isArray(coberturas)) {
    for (const cob of coberturas) {
      const deducible = cob.deducible || '';
      const cobertura = (cob.cobertura || cob.descripcion || '').toLowerCase();
      
      if (deducible && cobertura.includes('comprensiv')) {
        const deducibleStr = String(deducible);
        const match = deducibleStr.match(/(\d+(?:\.\d{2})?)/);
        if (match && match[1] && !result.comprensivo) {
          result.comprensivo = {
            amount: parseFloat(match[1]),
            currency: 'B/.',
            source: 'coberturas',
          };
        }
      }
      
      if (deducible && (cobertura.includes('colisión') || cobertura.includes('vuelco'))) {
        const deducibleStr = String(deducible);
        const match = deducibleStr.match(/(\d+(?:\.\d{2})?)/);
        if (match && match[1] && !result.colisionVuelco) {
          result.colisionVuelco = {
            amount: parseFloat(match[1]),
            currency: 'B/.',
            source: 'coberturas',
          };
        }
      }
    }
  }
  
  // Fuente 3: Mapeo según selección usuario (fallback)
  if (!result.comprensivo && !result.colisionVuelco && seleccionUsuario) {
    const mapeo = {
      bajo: { comprensivo: 500, colisionVuelco: 500 },
      medio: { comprensivo: 250, colisionVuelco: 250 },
      alto: { comprensivo: 100, colisionVuelco: 100 },
    };
    
    const valores = mapeo[seleccionUsuario];
    result.comprensivo = {
      amount: valores.comprensivo,
      currency: 'B/.',
      source: 'selección_usuario',
    };
    result.colisionVuelco = {
      amount: valores.colisionVuelco,
      currency: 'B/.',
      source: 'selección_usuario',
    };
  }
  
  return result;
}

// ============================================
// CALCULAR DESCUENTO BUEN CONDUCTOR
// ============================================

/**
 * Calcula descuento buen conductor según fórmula FEDPA
 * descuento = primaBaseSinImpuesto - (totalTarjeta - impuesto)
 */
export function calcularDescuentoBuenConductor(
  primaBase: number, // Prima sin impuesto
  totalTarjeta: number, // Total anual con impuesto
  impuesto1: number, // Impuesto 5%
  impuesto2: number // Impuesto 1%
): DescuentoBuenConductor {
  const impuestoTotal = impuesto1 + impuesto2;
  
  // Total neto sin impuesto
  const totalNetoSinImpuesto = totalTarjeta - impuestoTotal;
  
  // Descuento = prima base - total neto
  let descuento = primaBase - totalNetoSinImpuesto;
  
  // Nunca negativo
  descuento = Math.max(0, descuento);
  
  // Porcentaje
  const porcentaje = primaBase > 0 ? (descuento / primaBase) * 100 : 0;
  
  return {
    primaBase,
    totalTarjeta,
    impuesto: impuestoTotal,
    descuento: Math.round(descuento * 100) / 100,
    porcentaje: Math.round(porcentaje * 100) / 100,
  };
}

// ============================================
// FORMATEAR ASISTENCIA
// ============================================

/**
 * Formatea asistencia para UI
 */
export function formatAsistencia(asistencia: AsistenciaBeneficio): string {
  const parts: string[] = [asistencia.label];
  
  if (asistencia.qty && asistencia.unit) {
    parts.push(`${asistencia.qty} ${asistencia.unit}`);
  }
  
  if (asistencia.maxAmount) {
    if (asistencia.unit === 'galones') {
      parts.push(`hasta ${asistencia.maxAmount} galones`);
    } else {
      parts.push(`máx. B/. ${asistencia.maxAmount.toLocaleString()}`);
    }
  }
  
  if (asistencia.maxKm) {
    parts.push(`hasta ${asistencia.maxKm} km`);
  }
  
  return parts.join(' • ');
}
