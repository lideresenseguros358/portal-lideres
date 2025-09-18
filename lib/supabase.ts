// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey       = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Cliente público (para componentes React) – tolerante a envs faltantes */
function safeCreatePublic() {
  if (!supabaseUrl || !anonKey) {
    // Stub “seguro” que evita romper el render si aún no hay envs en Vercel
    return createClient('https://invalid.local', 'invalid', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      // Evitamos tocar localStorage en SSR
      global: { headers: {} as Record<string, string> },
    });
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/** Cliente admin (SOLO en /pages/api/**) */
function safeCreateAdmin() {
  if (!supabaseUrl || !serviceKey) {
    return createClient('https://invalid.local', 'invalid', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: { headers: {} as Record<string, string> },
    });
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabase = safeCreatePublic();
export const supabaseAdmin = safeCreateAdmin();

/** Headers con el token de sesión actual (para fetch a tus APIs propias) */
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

/** Helper de fetch que agrega headers de auth y devuelve json si aplica */
export async function apiFetch<T = any>(
  input: string,
  init?: RequestInit
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const auth = await getAuthHeaders();
  const res = await fetch(input, { ...(init || {}), headers: { ...(init?.headers || {}), ...auth } });

  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && (body as any).error) ||
      (typeof body === 'string' ? body : `HTTP ${res.status}`);
    return { ok: false, error: String(msg) };
  }

  return { ok: true, data: body as T };
}

