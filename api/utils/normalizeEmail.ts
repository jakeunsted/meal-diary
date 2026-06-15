export const normalizeEmail = (email: string): string => {
  const lower = email.trim().toLowerCase();
  const [local, domain] = lower.split('@');

  if (!local || !domain) {
    return lower;
  }

  const baseLocal = local.split('+')[0];

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return `${baseLocal.replace(/\./g, '')}@${domain}`;
  }

  return `${baseLocal}@${domain}`;
};
