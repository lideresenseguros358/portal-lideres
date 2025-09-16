// /lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente público para el navegador. Guarda la sesión (token) en localStorage.
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: typeof window !== 'undefined',
    // Evita errores en SSR cuando window no existe:
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

/**
* Encabezados de autenticación para llamar a tus API routes.
* - Authorization: Bearer <token>
* - x-user-id / x-email: compatibilidad con tu código actual
*/
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const user  = data.session?.user;

  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (user?.id)   h['x-user-id'] = user.id;
  if (user?.email) h['x-email'] = user.email;

  return h;
}

/** Helper opcional para hacer fetch a tus APIs incluyendo el Bearer */
export async function apiFetch(input: string, init?: RequestInit) {
  const auth = await getAuthHeaders();
  const res = await fetch(input, { ...init, headers: { ...(init?.headers || {}), ...auth } });
  // si la API devolviera HTML por error, evita .json() directo:
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res;
}
