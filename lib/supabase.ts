// /lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente público para el navegador. Guarda la sesión (token) en localStorage.
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Evita errores en SSR cuando window no existe:
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

/* ---------------------------
   Helpers de autenticación
---------------------------- */

// Encabezados de autenticación para llamar a tus API routes.
// Se recomienda siempre usar estos headers en tus `fetch`.
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

// Helper opcional para hacer fetch a tus APIs incluyendo el Bearer automáticamente.
export async function fetchWithAuth(input: string, init?: RequestInit): Promise<Response> {
  const auth = await getAuthHeaders();
  const res = await fetch(input, {
    ...init,
    headers: { ...(init?.headers || {}), ...auth },
  });

  if (!res.ok) {
    const txt = await res.text(); // leer error crudo si no es JSON válido
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }

  return res;
}
