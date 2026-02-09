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
 * FEDPA P2: Extrae servicios de asistencia con cantidades y montos REALES
 * Ejemplos de formato esperado:
 * - "Grúa: 2 eventos / USD 150 c/u"
 * - "Paso de corriente: 2 eventos"
 * - "Cerrajero: 1 evento / USD 75"
 * - "Gasolina: 1 evento / USD 50"
 */
export function normalizeAssistanceBenefits(
  beneficios: any[]
): AsistenciaBeneficio[] {
  const asistencias: AsistenciaBeneficio[] = [];
  
  if (!beneficios || !Array.isArray(beneficios)) {
    return asistencias;
  }
  
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
  
  // Procesar cada beneficio
  for (const beneficio of beneficios) {
    const descripcion = beneficio.descripcion || beneficio.nombre || beneficio.cobertura || '';
    const limite = beneficio.limite || beneficio.limites || '';
    const raw = `${descripcion} ${limite}`.trim();
    
    if (!raw) continue;
    
    const rawLower = raw.toLowerCase();
    
    // Detectar tipo de asistencia
    let label = '';
    let qty: number | undefined;
    let maxAmount: number | undefined;
    let maxKm: number | undefined;
    let unit = '';
    
    // GRÚA
    if (rawLower.includes('grúa') || rawLower.includes('grua') || rawLower.includes('remolque')) {
      label = 'Servicio de Grúa';
      
      // Extraer cantidad: "2 eventos", "3 servicios"
      const qtyMatch = raw.match(/(\d+)\s*(evento|servicio|vez)/i);
      if (qtyMatch && qtyMatch[1]) {
        qty = parseInt(qtyMatch[1]);
        unit = qtyMatch[2] || 'eventos';
      }
      
      // Extraer monto: "USD 150", "B/. 150", "$150"
      const amountMatch = raw.match(/(USD|B\/\.?|\$)\s*(\d+)/i);
      if (amountMatch && amountMatch[2]) {
        maxAmount = parseFloat(amountMatch[2]);
      }
      
      // Extraer kilómetros: "hasta 50 km"
      const kmMatch = raw.match(/(\d+)\s*km/i);
      if (kmMatch && kmMatch[1]) {
        maxKm = parseInt(kmMatch[1]);
      }
    }
    // PASO DE CORRIENTE
    else if (rawLower.includes('paso') && rawLower.includes('corriente')) {
      label = 'Paso de Corriente';
      const qtyMatch = raw.match(/(\d+)\s*(evento|servicio|vez)/i);
      if (qtyMatch && qtyMatch[1]) {
        qty = parseInt(qtyMatch[1]);
        unit = qtyMatch[2] || 'eventos';
      }
    }
    // GASOLINA
    else if (rawLower.includes('gasolina') || rawLower.includes('combustible')) {
      label = 'Suministro de Gasolina';
      const qtyMatch = raw.match(/(\d+)\s*(evento|servicio|vez|gal)/i);
      if (qtyMatch && qtyMatch[1]) {
        qty = parseInt(qtyMatch[1]);
        unit = qtyMatch[2] || 'galones';
      }
      const amountMatch = raw.match(/(USD|B\/\.?|\$)\s*(\d+)/i);
      if (amountMatch && amountMatch[2]) {
        maxAmount = parseFloat(amountMatch[2]);
      }
    }
    // CERRAJERO
    else if (rawLower.includes('cerrajero') || rawLower.includes('cerradura')) {
      label = 'Servicio de Cerrajero';
      const qtyMatch = raw.match(/(\d+)\s*(evento|servicio|vez)/i);
      if (qtyMatch && qtyMatch[1]) {
        qty = parseInt(qtyMatch[1]);
        unit = qtyMatch[2] || 'eventos';
      }
      const amountMatch = raw.match(/(USD|B\/\.?|\$)\s*(\d+)/i);
      if (amountMatch && amountMatch[2]) {
        maxAmount = parseFloat(amountMatch[2]);
      }
    }
    // CAMBIO DE LLANTA
    else if (rawLower.includes('llanta') || rawLower.includes('neumático')) {
      label = 'Cambio de Llanta';
      const qtyMatch = raw.match(/(\d+)\s*(evento|servicio|vez)/i);
      if (qtyMatch && qtyMatch[1]) {
        qty = parseInt(qtyMatch[1]);
        unit = qtyMatch[2] || 'eventos';
      }
    }
    // ASISTENCIA MÉDICA
    else if (rawLower.includes('médica') || rawLower.includes('medica')) {
      label = 'Asistencia Médica Telefónica';
      if (rawLower.includes('24') || rawLower.includes('ilimitado')) {
        unit = '24/7';
      }
    }
    
    // Solo agregar si identificamos el servicio
    if (label) {
      asistencias.push({
        label,
        qty,
        maxAmount,
        maxKm,
        unit,
        rawText: raw,
      });
    }
  }
  
  return asistencias;
}

// ============================================
// HELPER: FORMATEAR ASISTENCIA
// ============================================

/**
 * FEDPA P2: Formatea asistencia para mostrar en UI
 * Ejemplos:
 * - "Grúa: 2 servicios/año • Máximo B/.150"
 * - "Paso de corriente: 2 eventos/año"
 * - "Cerrajero: 1 evento/año • Máximo B/.75"
 */
export function formatAsistencia(asistencia: AsistenciaBeneficio): string {
  const parts: string[] = [asistencia.label];
  
  // Cantidad
  if (asistencia.qty && asistencia.unit) {
    parts.push(`${asistencia.qty} ${asistencia.unit}/año`);
  } else if (asistencia.qty) {
    parts.push(`${asistencia.qty} eventos/año`);
  } else if (asistencia.unit) {
    parts.push(asistencia.unit);
  }
  
  // Monto máximo
  if (asistencia.maxAmount) {
    parts.push(`Máximo B/.${asistencia.maxAmount}`);
  }
  
  // Kilómetros (grua)
  if (asistencia.maxKm) {
    parts.push(`hasta ${asistencia.maxKm} km`);
  }
  
  // Unir con punto medio
  return parts.join(' • ');
}

// ============================================
// NORMALIZAR DEDUCIBLES
// ============================================

/**
 * FEDPA P2: Extrae deducibles reales - NUNCA $0
 * Fuentes:
 * - beneficios (campo deducible)
 * - coberturas (campo deducible)
 * - mapeo interno por nivel (bajo/medio/alto)
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
  
  // Fuente 2: Coberturas (API FEDPA devuelve campos en MAYÚSCULAS)
  if (coberturas && Array.isArray(coberturas)) {
    for (const cob of coberturas) {
      // Soportar MAYÚSCULAS (API FEDPA) y minúsculas
      const deducible = cob.DEDUCIBLE ?? cob.deducible ?? '';
      const cobertura = (cob.DESCCOBERTURA || cob.COBERTURA || cob.cobertura || cob.descripcion || '').toLowerCase();
      const deducibleNum = typeof deducible === 'number' ? deducible : parseFloat(String(deducible));
      
      if (deducibleNum > 0 && cobertura.includes('comprensiv')) {
        if (!result.comprensivo) {
          result.comprensivo = {
            amount: deducibleNum,
            currency: 'B/.',
            source: 'coberturas',
          };
        }
      }
      
      if (deducibleNum > 0 && (cobertura.includes('colisi') || cobertura.includes('vuelco'))) {
        if (!result.colisionVuelco) {
          result.colisionVuelco = {
            amount: deducibleNum,
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
// PARSEAR ENDOSOS DESDE BENEFICIOS API
// ============================================

export interface ParsedEndosoData {
  fullExtrasBeneficios: string[];
  porcelanaBeneficios: string[];
  porcelanaDescripcion: string;
}

/**
 * Parsea el texto crudo de beneficios de la API FEDPA para extraer
 * los sub-beneficios de Endoso Full Extras y Endoso Porcelana.
 * 
 * La API devuelve texto con formato:
 * "ENDOSO FULL EXTRAS BENEFICIOS: 1. ... 2. ... 19. ..."
 * "ENDOSO PORCELANA BENEFICIOS IGUAL AL ANTERIOR, SOLO QUE EN LOS PUNTOS
 *  QUE DEBAJO SE DETALLAN SE ADICIONAN Y MEJORAN:: 6. ... 10. ... 15. ..."
 */
export function parseEndosoBeneficiosFromAPI(rawTexts: string[]): ParsedEndosoData {
  const result: ParsedEndosoData = {
    fullExtrasBeneficios: [],
    porcelanaBeneficios: [],
    porcelanaDescripcion: '',
  };
  
  if (!rawTexts || rawTexts.length === 0) {
    return result;
  }
  
  // Join all texts into one blob for parsing
  const fullText = rawTexts.join(' ');
  
  // Find the ENDOSO PORCELANA section marker
  const porcelanaMarkerRegex = /ENDOSO\s+PORCELANA\s*/i;
  const porcelanaMatch = fullText.match(porcelanaMarkerRegex);
  
  let fullExtrasText = '';
  let porcelanaText = '';
  
  if (porcelanaMatch && porcelanaMatch.index !== undefined) {
    fullExtrasText = fullText.substring(0, porcelanaMatch.index).trim();
    porcelanaText = fullText.substring(porcelanaMatch.index).trim();
  } else {
    // No Porcelana section found, all text is Full Extras
    fullExtrasText = fullText;
  }
  
  // Extract numbered items from Full Extras section
  // Remove the header "ENDOSO FULL EXTRAS BENEFICIOS:"
  const fullExtrasClean = fullExtrasText
    .replace(/ENDOSO\s+FULL\s+EXTRAS\s+BENEFICIOS\s*:?\s*/i, '')
    .trim();
  
  result.fullExtrasBeneficios = extractNumberedItems(fullExtrasClean);
  
  // Fallback: if no numbered items found, the API may return individual text items
  // In that case, use each raw text as a separate benefit
  if (result.fullExtrasBeneficios.length === 0 && rawTexts.length > 1) {
    // Check if any text contains "ENDOSO" markers — if not, they're individual benefits
    const hasEndosoMarker = rawTexts.some(t => /ENDOSO\s+(FULL|PORCELANA)/i.test(t));
    if (!hasEndosoMarker) {
      result.fullExtrasBeneficios = rawTexts
        .filter(t => t.trim().length > 0)
        .map(t => t.trim());
      console.log(`[FEDPA Parser] Fallback: using ${result.fullExtrasBeneficios.length} individual texts as Full Extras`);
    }
  }
  
  // Extract Porcelana description and numbered items
  if (porcelanaText) {
    // Extract the description/header of Porcelana section
    const porcelanaHeaderMatch = porcelanaText.match(
      /ENDOSO\s+PORCELANA\s+(.*?)(?=::\s*\d|:\s*\d)/is
    );
    if (porcelanaHeaderMatch && porcelanaHeaderMatch[1]) {
      result.porcelanaDescripcion = porcelanaHeaderMatch[1]
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Extract the numbered items after the header
    // Find where the numbered items start (after :: or :)
    const itemsStartMatch = porcelanaText.match(/::\s*(\d)/);
    if (itemsStartMatch && itemsStartMatch.index !== undefined) {
      const itemsText = porcelanaText.substring(itemsStartMatch.index + 2).trim();
      result.porcelanaBeneficios = extractNumberedItems(itemsText);
    } else {
      // Try single colon
      const singleColonMatch = porcelanaText.match(/:\s*(\d)/);
      if (singleColonMatch && singleColonMatch.index !== undefined) {
        const itemsText = porcelanaText.substring(singleColonMatch.index + 1).trim();
        result.porcelanaBeneficios = extractNumberedItems(itemsText);
      }
    }
  }
  
  console.log(`[FEDPA Parser] Full Extras: ${result.fullExtrasBeneficios.length} items, Porcelana: ${result.porcelanaBeneficios.length} items`);
  
  return result;
}

/**
 * Extrae items numerados de un texto.
 * Formato: "1. texto 2. texto 3. texto"
 * Los números pueden no ser consecutivos (ej: 6. 10. 15.)
 */
function extractNumberedItems(text: string): string[] {
  if (!text) return [];
  
  const items: string[] = [];
  
  // Split by numbered pattern: digit(s) followed by period and space
  // Use regex to find all "N. text" patterns
  const regex = /(\d+)\.\s+/g;
  const matches: { index: number; number: number }[] = [];
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({ index: match.index, number: parseInt(match[1] || '0') });
  }
  
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const start = current.index + current.number.toString().length + 2; // skip "N. "
    const next = matches[i + 1];
    const end = next ? next.index : text.length;
    
    let itemText = text.substring(start, end).trim();
    // Clean trailing periods or whitespace
    itemText = itemText.replace(/\s+/g, ' ').trim();
    // Remove trailing period if it's the last char
    if (itemText.endsWith('.')) {
      itemText = itemText.slice(0, -1).trim();
    }
    
    if (itemText.length > 0) {
      items.push(itemText);
    }
  }
  
  return items;
}
