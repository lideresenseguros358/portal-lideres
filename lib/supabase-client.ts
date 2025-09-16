// /lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente PÚBLICO: seguro para el navegador
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // evita crashear en SSR por localStorage
  global: { headers: {} },
});

// ====== Encabezados bearer actuales (para tus APIs) ======
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  const u = data.session?.user;

  const h: Record<string, string> = {};
  if (t) h.Authorization = `Bearer ${t}`;
  if (u?.id) h['x-user-id'] = u.id;
  if (u?.email) h['x-user-email'] = u.email;
  return h;
}

// ====== Fetch con contrato { ok, data, error } (compat) ======
export type ApiJson<T = any> = { ok: boolean; data?: T; error?: string };

export async function apiFetch<T = any>(
  input: string,
  init: RequestInit = {}
): Promise<ApiJson<T>> {
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

  if (body && typeof body === 'object' && 'ok' in body) {
    return body as ApiJson<T>;
  }
  return { ok: true, data: body as T };
}

// Alias para mantener imports existentes
export const authFetch = apiFetch;
