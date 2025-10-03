import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function getSupabaseAdmin() {
  return createClient<Database>(url, service, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'lissa/portal' } },
  });
}

// Type exports for use across the app
export type DB = Database['public'];
export type Tables<T extends keyof DB['Tables']> = DB['Tables'][T]['Row'];
export type TablesInsert<T extends keyof DB['Tables']> = DB['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof DB['Tables']> = DB['Tables'][T]['Update'];
export type Enums<T extends keyof DB['Enums']> = DB['Enums'][T];
