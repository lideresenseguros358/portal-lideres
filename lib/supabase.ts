// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Variables de entorno (asegúrate de tenerlas en tu .env.local)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Cliente normal (para frontend/backend autenticado)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin (para funciones del backend con privilegios)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
