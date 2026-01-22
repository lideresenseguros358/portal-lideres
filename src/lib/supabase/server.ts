import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../database.types";

export async function getSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component: ignore set errors
          }
        },
      },
    }
  );
}

// Alias export para compatibilidad con código que usa createClient
export const createClient = getSupabaseServer;

// Type exports for use across the app
export type DB = Database['public'];
export type Tables<T extends keyof DB['Tables']> = DB['Tables'][T]['Row'];
export type TablesInsert<T extends keyof DB['Tables']> = DB['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof DB['Tables']> = DB['Tables'][T]['Update'];
export type Enums<T extends keyof DB['Enums']> = DB['Enums'][T];
