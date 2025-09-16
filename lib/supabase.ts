// /lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Evita crash si faltan envs en producción: crea un stub seguro
function safeCreatePublic() {
  if (!supabaseUrl || !supabaseAnonKey) {
    // cliente “dummy” que no rompe la app si faltan envs
    return createClient('https://invalid.local', 'invalid', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window === 'undefined' ? undefined : window.localStorage,
    },
  });
}

function safeCreateAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return createClient('https://invalid.local', 'invalid', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabase = safeCreatePublic();
export const supabaseAdmin = safeCreateAdmin();

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

export async function apiFetch(input: string, init?: RequestInit) {
  const headers = await getAuthHeaders();
  const res = await fetch(input, { ...(init ?? {}), headers: { ...(init?.headers ?? {}), ...headers } });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return txt;
}
