// /lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl       = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabaseServiceKey= process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Cliente público (API routes sin sesión persistente)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

// Cliente admin (sólo backend / API con privilegios)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
