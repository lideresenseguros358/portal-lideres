import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AnyClient = SupabaseClient<any, "public", any>;

let adminClient: AnyClient | null = null;
let browserClient: AnyClient | null = null;

const getUrl = () => {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is required");
  return url;
};

export const admin = (): AnyClient => {
  if (adminClient) return adminClient;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin access");
  }

  adminClient = createClient(getUrl(), key, {
    auth: { persistSession: false },
  });
  return adminClient;
};

export const client = (): AnyClient => {
  if (browserClient) return browserClient;

  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required for client access");
  }

  browserClient = createClient(getUrl(), key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return browserClient;
};

export type { SupabaseClient };
