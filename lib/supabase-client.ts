// /lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente público (mantén la sesión en cliente)
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // evita errores en SSR
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// Cliente admin (solo server / API routes)
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ===== Encabezados con el Bearer actual =====
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const user = data.session?.user;

  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (user?.id) h['x-user-id'] = user.id;
  if (user?.email) h['x-user-email'] = user.email;
  return h;
}

// ===== Fetch con contrato ok/data/error (compat) =====
export type ApiJson<T = any> = { ok: boolean; data?: T; error?: string };

export async function apiFetch<T = any>(input: string, init: RequestInit = {}): Promise<ApiJson<T>> {
  const auth = await getAuthHeaders();
  const res = await fetch(input, { ...init, headers: { ...init.headers, ...auth } });

  const ct = res.headers.get('content-type') || '';
  let body: any = null;
  try {
    body = ct.includes('application/json') ? await res.json() : await res.text();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && body.error) ||
      (typeof body === 'string' ? body : `HTTP ${res.status}`);
    return { ok: false, error: String(msg ?? 'Request failed') };
  }

  // Si el backend ya devuelve { ok, data, error }, respétalo
  if (body && typeof body === 'object' && 'ok' in body && ('data' in body || 'error' in body)) {
    return body as ApiJson<T>;
  }

  // Si es un JSON arbitrario o texto, lo ponemos en data
  return { ok: true, data: body as T };
}

// Alias para no tocar los imports existentes
export const authFetch = apiFetch;

