// /lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// envs públicas (cliente) y de servicio (sólo backend)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

/**
* Cliente PÚBLICO (browser). Mantiene la sesión en localStorage.
*/
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // evita errores SSR cuando window no existe
    storage: typeof window === 'undefined' ? undefined : window.localStorage,
  },
});

/**
* Cliente ADMIN (sólo server / API Routes).
* ¡OJO! No usar en el navegador.
*/
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
* Headers de autenticación (Bearer + metadatos) para llamar tus API routes
* desde el cliente.
*/
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const user = data.session?.user;

  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (user?.id) h['x-user-id'] = user.id;
  if (user?.email) h['x-email'] = user.email;
  return h;
}

/**
* Helper opcional para usar fetch a tus APIs adjuntando Bearer
* y retornando texto cuando no es JSON (evita el típico “Unexpected token '<' …”)
*/
export async function apiFetch(input: string, init?: RequestInit) {
  const headers = await getAuthHeaders();
  const res = await fetch(input, { ...(init ?? {}), headers: { ...(init?.headers ?? {}), ...headers } });

  // intenta JSON; si la respuesta es HTML o texto plano, devuélvelo como texto
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return txt;
}
