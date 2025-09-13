// lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Nunca expongas este cliente al browser
export const supabaseAdmin = createClient(url, service, {
  auth: { persistSession: false },
});
