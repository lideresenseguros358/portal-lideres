export const getRedirectUrl = () => {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${base}/auth/callback`;
};

export const getPasswordRecoveryUrl = () => {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${base}/auth/callback?type=recovery`;
};
