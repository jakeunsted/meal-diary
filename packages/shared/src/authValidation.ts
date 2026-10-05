const MAX_EMAIL_LENGTH = 254;

/**
 * Validate an email address format (linear-time; avoids ReDoS-prone regex).
 */
export const isValidEmail = (email: string): boolean => {
  if (typeof email !== 'string' || email.length === 0 || email.length > MAX_EMAIL_LENGTH) {
    return false;
  }

  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) {
    return false;
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (localPart.length === 0 || domain.length === 0) {
    return false;
  }

  const dotIndex = domain.indexOf('.');
  if (dotIndex <= 0 || dotIndex === domain.length - 1) {
    return false;
  }

  for (let i = 0; i < email.length; i++) {
    const code = email.charCodeAt(i);
    if (code <= 32 || code === 127) {
      return false;
    }
  }

  return true;
};

export type PasswordRequirementId =
  | 'minLength'
  | 'lowercase'
  | 'uppercase'
  | 'number'
  | 'special';

export interface PasswordRequirement {
  id: PasswordRequirementId;
  test: (password: string) => boolean;
}

const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/\\`~]/;

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: 'minLength',
    test: (password) => password.length >= 8,
  },
  {
    id: 'lowercase',
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: 'uppercase',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'number',
    test: (password) => /[0-9]/.test(password),
  },
  {
    id: 'special',
    test: (password) => SPECIAL_CHAR_PATTERN.test(password),
  },
];

export interface PasswordRequirementResult {
  id: PasswordRequirementId;
  met: boolean;
}

export const evaluatePassword = (password: string): PasswordRequirementResult[] => {
  const value = typeof password === 'string' ? password : '';
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    id: requirement.id,
    met: requirement.test(value),
  }));
};

export const isPasswordValid = (password: string): boolean => {
  return evaluatePassword(password).every((result) => result.met);
};
