// /lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ⚠️ Este archivo NO debe importarse desde el navegador.
// Úsalo sólo en /pages/api/* o en código de servidor.
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
