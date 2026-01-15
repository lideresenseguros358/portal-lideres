export const getRedirectUrl = () => {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${base}/auth/callback`;
};

export const getPasswordRecoveryUrl = () => {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // Supabase ignora query params en redirectTo, pero agrega automáticamente type=recovery
  return `${base}/auth/callback`;
};
