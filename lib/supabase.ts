// /lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente público (guarda sesión del navegador). Guarda el token en localStorage.
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

/** Encabezados de autenticación para llamar a tus API routes con Bearer */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const user  = data.session?.user;
  const h: Record<string, string> = {};
  if (token) h['authorization'] = `Bearer ${token}`;
  if (user?.id) h['x-user-id'] = user.id;
  if (user?.email) h['x-email'] = user.email;
  return h;
}

/** Helper opcional para fetch a tus APIs incluyendo el Bearer */
export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = await getAuthHeaders();
  const res = await fetch(input, { ...(init ?? {}), headers: { ...(init?.headers ?? {}), ...headers } });
  if (!res.ok) {
    const txt = await res.text(); // si viene HTML no intentes .json()
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res;
}
