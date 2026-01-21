/**
 * Helper para formatear fechas sin timezone shift
 * El problema: new Date('2025-12-18') crea la fecha a las 00:00 UTC
 * que en zonas UTC-5 se muestra como 2025-12-17
 * 
 * Solución: Parsear manualmente y crear fecha en timezone local
 */

export function formatDateLocal(dateStr: string, locale: string = 'es-PA'): string {
  if (!dateStr) return '';
  
  try {
    // Parsear fecha manualmente para evitar timezone shift
    const splitDate = dateStr.split('T');
    if (splitDate.length === 0) return dateStr;
    
    const datePart = splitDate[0];
    if (!datePart) return dateStr;
    
    const parts = datePart.split('-').map(Number);
    
    if (parts.length !== 3 || parts.some(p => isNaN(p))) {
      return dateStr; // Retornar string original si no se puede parsear
    }
    
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    
    if (!year || !month || !day) return dateStr;
    
    // Crear fecha en timezone local (no UTC)
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    return dateStr; // Retornar string original en caso de error
  }
}

export function formatDateLongLocal(dateStr: string, locale: string = 'es-PA'): string {
  if (!dateStr) return '';
  
  try {
    const splitDate = dateStr.split('T');
    if (splitDate.length === 0) return dateStr;
    
    const datePart = splitDate[0];
    if (!datePart) return dateStr;
    
    const parts = datePart.split('-').map(Number);
    
    if (parts.length !== 3 || parts.some(p => isNaN(p))) {
      return dateStr;
    }
    
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    
    if (!year || !month || !day) return dateStr;
    
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (error) {
    return dateStr;
  }
}
