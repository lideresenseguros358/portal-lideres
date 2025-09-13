// /lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente ADMIN (sólo en server / API routes)
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

// Cliente público (si necesitas en cliente)
export const supabaseAnon = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true } }
);
