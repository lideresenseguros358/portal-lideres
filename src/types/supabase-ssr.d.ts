declare module "@supabase/ssr" {
  import type { SupabaseClientOptions } from "@supabase/supabase-js";
  import type { SupabaseClient } from "@supabase/supabase-js";

  export function createBrowserClient<Database = any, SchemaName extends string = "public">(
    supabaseUrl: string,
    supabaseKey: string,
    options?: SupabaseClientOptions<"public">
  ): SupabaseClient<Database, SchemaName>;

  export function createServerClient<Database = any, SchemaName extends string = "public">(
    supabaseUrl: string,
    supabaseKey: string,
    options: {
      cookies: () => any;
    }
  ): SupabaseClient<Database, SchemaName>;
}
