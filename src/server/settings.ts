import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/server";

type AppSettingRow = Tables<"app_settings">;

const getClient = () => getSupabaseAdmin();
/**
 * Obtiene un setting individual desde la tabla `app_settings`.
 */
export const getSetting = async <T = unknown>(key: string): Promise<T | null> => {
  const client = getClient();
  try {
    const { data, error } = await client
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    return (data.value ?? null) as T;
  } catch (error) {
    console.error("getSetting error", error);
    return null;
  }
};

/**
 * Devuelve todos los settings disponibles en `app_settings`.
 */
export const getAllSettings = async (): Promise<Record<string, any>> => {
  const client = getClient();
  try {
    const { data, error } = await client
      .from("app_settings")
      .select("key, value");
    if (error || !data) return {};
    return (data as AppSettingRow[]).reduce<Record<string, any>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  } catch (error) {
    console.error("getAllSettings error", error);
    return {};
  }
};
