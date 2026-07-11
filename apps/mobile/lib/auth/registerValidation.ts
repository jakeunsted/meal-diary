export interface RegisterFormData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirm_password: string;
  terms_accepted: boolean;
}

export interface RegisterFieldErrors {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirm_password: string;
  terms_accepted: string;
  general: string;
}

export const emptyRegisterErrors = (): RegisterFieldErrors => ({
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  confirm_password: '',
  terms_accepted: '',
  general: '',
});

export function validateRegisterForm(
  data: RegisterFormData,
  t: (key: string) => string
): { hasErrors: boolean; errors: RegisterFieldErrors } {
  const errors = emptyRegisterErrors();
  let hasErrors = false;

  if (!data.username.trim()) {
    errors.username = t('registration.errors.usernameRequired');
    hasErrors = true;
  }

  if (!data.email.trim()) {
    errors.email = t('registration.errors.emailRequired');
    hasErrors = true;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = t('registration.errors.emailInvalid');
    hasErrors = true;
  }

  if (!data.first_name.trim()) {
    errors.first_name = t('registration.errors.firstNameRequired');
    hasErrors = true;
  }

  if (!data.last_name.trim()) {
    errors.last_name = t('registration.errors.lastNameRequired');
    hasErrors = true;
  }

  if (!data.password) {
    errors.password = t('registration.errors.passwordRequired');
    hasErrors = true;
  }

  if (!data.confirm_password) {
    errors.confirm_password = t('registration.errors.confirmPasswordRequired');
    hasErrors = true;
  } else if (data.password !== data.confirm_password) {
    errors.confirm_password = t('registration.errors.passwordMismatch');
    hasErrors = true;
  }

  if (!data.terms_accepted) {
    errors.terms_accepted = t('registration.errors.termsRequired');
    hasErrors = true;
  }

  return { hasErrors, errors };
}
