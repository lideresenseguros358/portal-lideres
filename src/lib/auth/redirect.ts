export const getRedirectUrl = () => {
  return "https://portal.lideresenseguros.com/auth/callback";
};

export const getPasswordRecoveryUrl = () => {
  // Recovery va directo a update-password, no a callback
  return "https://portal.lideresenseguros.com/update-password";
};
