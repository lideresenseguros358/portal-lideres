/**
 * Next.js Instrumentation — runs once at server startup.
 * Used for environment validation and startup checks.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { checkEnvOnStartup } = await import('@/lib/security/env-check');
    checkEnvOnStartup();
  }
}
