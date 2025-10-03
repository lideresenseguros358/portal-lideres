import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Load .env.local explicitly (fallback to .env) for tsx scripts.
 * This avoids relying on Next.js' loader and prevents early crashes.
 */
const root = process.cwd();
const localPath = resolve(root, ".env.local");
const defaultPath = resolve(root, ".env");

config({
  path: existsSync(localPath) ? localPath : defaultPath,
});

/** Throw if a required var is missing. */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`[ENV] Missing ${name}. Create/update your .env.local`);
  }
  return v;
}

/** Only the keys we currently require at runtime for scripts/endpoints */
export const env = {
  NEXT_PUBLIC_SITE_URL: requireEnv("NEXT_PUBLIC_SITE_URL"),
  NEXT_PUBLIC_SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  MASTER_INVITE_TOKEN: requireEnv("MASTER_INVITE_TOKEN"),
  // Optional, but we’ll read it if present:
  JWT_SECRET: process.env.JWT_SECRET,
} as const;

/** Helper to log masked env values for debugging without leaking secrets */
export function printEnvSummary() {
  const mask = (s?: string) =>
    !s ? "(empty)" : s.length <= 8 ? "********" : `${s.slice(0, 4)}***${s.slice(-4)}`;
  console.log("[ENV] Loaded: ", {
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: mask(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: mask(env.SUPABASE_SERVICE_ROLE_KEY),
    MASTER_INVITE_TOKEN: mask(env.MASTER_INVITE_TOKEN),
    JWT_SECRET: mask(env.JWT_SECRET),
  });
}
