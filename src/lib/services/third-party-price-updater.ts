/**
 * Servicio para actualizar precios mínimos de Daños a Terceros
 * Se llama automáticamente después de cada cotización exitosa
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface PriceUpdateData {
  insurer: 'FEDPA' | 'INTERNACIONAL';
  price: number;
  userId?: string;
}

/**
 * Actualiza el precio mínimo de Daños a Terceros en la BD
 * Solo actualiza si el nuevo precio es menor al actual
 */
export async function updateThirdPartyMinPrice(data: PriceUpdateData): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    // Llamar función SQL que maneja la lógica de actualización
    const { error } = await supabase.rpc('update_third_party_min_price', {
      p_insurer_name: data.insurer,
      p_new_price: data.price,
      p_user_id: data.userId || null,
    });

    if (error) {
      console.error('[Price Updater] Error actualizando precio:', error);
      return;
    }

    console.log('[Price Updater] Precio actualizado:', {
      insurer: data.insurer,
      price: data.price,
    });
  } catch (error) {
    console.error('[Price Updater] Error general:', error);
  }
}

/**
 * Obtiene el precio actual guardado para una aseguradora
 */
export async function getCurrentMinPrice(insurer: string): Promise<number | null> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('third_party_min_prices')
      .select('min_price')
      .eq('insurer_name', insurer)
      .eq('policy_type', 'DANOS_TERCEROS')
      .single();

    if (error || !data) {
      return null;
    }

    return parseFloat(data.min_price);
  } catch (error) {
    console.error('[Price Updater] Error obteniendo precio actual:', error);
    return null;
  }
}
