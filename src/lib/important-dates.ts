import { getSupabaseServer } from './supabase/server';
import type { Database } from './database.types';

type ImportantDates = Database['public']['Tables']['important_dates']['Row'];
type ImportantDatesInsert = Database['public']['Tables']['important_dates']['Insert'];
type ImportantDatesUpdate = Database['public']['Tables']['important_dates']['Update'];

export interface ImportantDatesData {
  month: number;
  year: number;
  vidaConCancelacionDay: number;
  viaRegularDay: number;
  apadeaDate1: number;
  apadeaDate2: number;
  cierreMesDay: number;
  newsText: string;
  newsActive: boolean;
}

/**
 * Obtener las fechas importantes del mes actual
 */
export async function getImportantDates(): Promise<ImportantDatesData | null> {
  const supabase = await getSupabaseServer();
  
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const { data, error } = await supabase
    .from('important_dates')
    .select('*')
    .eq('month', currentMonth)
    .eq('year', currentYear)
    .single();
  
  if (error || !data) {
    console.log('[IMPORTANT DATES] No data found, using defaults');
    // Retornar valores por defecto
    return {
      month: currentMonth,
      year: currentYear,
      vidaConCancelacionDay: 15,
      viaRegularDay: 20,
      apadeaDate1: 10,
      apadeaDate2: 25,
      cierreMesDay: 30,
      newsText: 'Recuerda actualizar tus trámites pendientes antes del cierre.',
      newsActive: true,
    };
  }
  
  return {
    month: data.month,
    year: data.year,
    vidaConCancelacionDay: data.vida_con_cancelacion_day ?? 15,
    viaRegularDay: data.via_regular_day ?? 20,
    apadeaDate1: data.apadea_date1 ?? 10,
    apadeaDate2: data.apadea_date2 ?? 25,
    cierreMesDay: data.cierre_mes_day ?? 30,
    newsText: data.news_text ?? '',
    newsActive: data.news_active ?? true,
  };
}

/**
 * Actualizar las fechas importantes (solo Master)
 */
export async function updateImportantDates(dates: ImportantDatesData, userId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServer();
  
  const updateData: ImportantDatesUpdate = {
    vida_con_cancelacion_day: dates.vidaConCancelacionDay,
    via_regular_day: dates.viaRegularDay,
    apadea_date1: dates.apadeaDate1,
    apadea_date2: dates.apadeaDate2,
    cierre_mes_day: dates.cierreMesDay,
    news_text: dates.newsText,
    news_active: dates.newsActive,
    updated_by: userId,
  };
  
  // Intentar actualizar primero
  const { data: existingData } = await supabase
    .from('important_dates')
    .select('id')
    .eq('month', dates.month)
    .eq('year', dates.year)
    .single();
  
  if (existingData) {
    // Actualizar registro existente
    const { error } = await supabase
      .from('important_dates')
      .update(updateData)
      .eq('month', dates.month)
      .eq('year', dates.year);
    
    if (error) {
      console.error('[UPDATE IMPORTANT DATES] Error:', error);
      return { success: false, error: error.message };
    }
  } else {
    // Insertar nuevo registro
    const insertData: ImportantDatesInsert = {
      month: dates.month,
      year: dates.year,
      ...updateData,
    };
    
    const { error } = await supabase
      .from('important_dates')
      .insert(insertData);
    
    if (error) {
      console.error('[INSERT IMPORTANT DATES] Error:', error);
      return { success: false, error: error.message };
    }
  }
  
  return { success: true };
}
