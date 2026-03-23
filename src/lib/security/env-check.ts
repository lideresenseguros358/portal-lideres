/**
 * Environment Variable Validation
 * ================================
 * Fail-fast validation of required environment variables at startup.
 * Import this in instrumentation.ts or layout.ts to catch misconfig early.
 */

interface EnvVar {
  name: string;
  required: boolean;
  /** If true, must not be a well-known placeholder */
  noPlaceholder?: boolean;
}

const REQUIRED_VARS: EnvVar[] = [
  // Supabase
  { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, noPlaceholder: true },
  // Cron protection
  { name: 'CRON_SECRET', required: true, noPlaceholder: true },
];

const PLACEHOLDER_VALUES = ['changeme', 'your-key-here', 'xxx', 'TODO', 'REPLACE_ME', 'sk_test_', 'pk_test_'];

/**
 * Validate all required environment variables are present and non-placeholder.
 * Call at app startup. Returns array of error messages (empty = all good).
 */
export function validateEnv(): string[] {
  const errors: string[] = [];

  for (const v of REQUIRED_VARS) {
    const value = process.env[v.name];
    if (!value || value.trim() === '') {
      if (v.required) {
        errors.push(`Missing required env var: ${v.name}`);
      }
      continue;
    }
    if (v.noPlaceholder) {
      const lower = value.toLowerCase();
      for (const ph of PLACEHOLDER_VALUES) {
        if (lower === ph || lower.startsWith(ph)) {
          errors.push(`Env var ${v.name} contains placeholder value`);
          break;
        }
      }
    }
  }

  return errors;
}

/**
 * Run validation and log results. Does NOT throw in production
 * (to avoid crashing), but logs critical warnings.
 */
export function checkEnvOnStartup(): void {
  const errors = validateEnv();
  if (errors.length === 0) {
    console.log('[ENV-CHECK] ✅ All required environment variables present');
    return;
  }

  for (const err of errors) {
    console.error(`[ENV-CHECK] ❌ ${err}`);
  }

  // In development, be loud
  if (process.env.NODE_ENV === 'development') {
    console.error(`[ENV-CHECK] ⚠️ ${errors.length} environment variable(s) missing or invalid`);
  }
}
