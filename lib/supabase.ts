// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

/* ========= ENV requeridas =========
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
==================================== */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Cliente público (para componentes React) */
export const supabase = createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Cliente admin (solo usar en /pages/api/**) */
export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/** Headers con el token de sesión actual (para fetch a APIs propias) */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  const u = data.session?.user;
  if (u?.id)    h['x-user-id'] = u.id;
  if (u?.email) h['x-user-email'] = u.email;
  return h;
}

/** fetch helper que agrega los headers de auth y devuelve json si aplica */
export async function apiFetch<T = any>(
  input: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const auth = await getAuthHeaders();
  const res = await fetch(input, { ...init, headers: { ...(init.headers || {}), ...auth } });

  const ctype = res.headers.get('content-type') || '';
  const body = ctype.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && (body.error || (body as any).message)) ||
      `HTTP ${res.status}`;
    return { ok: false, error: String(msg) };
  }
  return { ok: true, data: body as T };
}

