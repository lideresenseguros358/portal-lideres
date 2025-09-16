// /lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente público (para el browser)
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// Cliente admin (solo en API routes / server)
export const supabaseAdmin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Helpers para las páginas cliente
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const user = data.session?.user;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (user?.id) headers['x-user-id'] = user.id;
  if (user?.email) headers['x-email'] = user.email;
  return headers;
}

/** fetch con Bearer automáticamente */
export async function authFetch(input: string, init?: RequestInit) {
  const h = await getAuthHeaders();
  const res = await fetch(input, { ...(init || {}), headers: { ...(init?.headers || {}), ...h } });
  // evita que Next muestre HTML de error por .json() de un HTML
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}
