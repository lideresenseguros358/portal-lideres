// /lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente público (navegador) – guarda sesión en localStorage
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // ¡MUY IMPORTANTE! No tocar window en SSR
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// Cliente admin (sólo para API routes / server)
export const supabaseAdmin = createClient(url, service, {
  auth: { persistSession: false },
});

// Encabezados para llamar APIs con Bearer
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  const user = data.session?.user;
  if (user?.id) h['x-user-id'] = user.id;
  if (user?.email) h['x-email'] = user.email;
  return h;
}

// Helper opcional para fetch a tus APIs incluyendo el Bearer
export async function apiFetch(input: string, init?: RequestInit) {
  const auth = await getAuthHeaders();
  const res = await fetch(input, { ...(init || {}), headers: { ...(init?.headers || {}), ...auth } });
  // Evita “Unexpected token < … not valid JSON” cuando el server responde HTML
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res;
}

