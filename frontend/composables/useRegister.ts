import { Preferences } from '@capacitor/preferences';
import { isPasswordValid, isValidEmail } from '@meal-diary/shared';

interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  terms_accepted: boolean;
  hasErrors: boolean;
}

export const useRegister = () => {
  const { t } = useI18n();

  /**
   * Store the register string in the capacitor storage
   * @param registerString - The register string to store
   */
  const storeRegisterString = async (registerString: string) => {
    Preferences.set({
      key: 'registerString',
      value: registerString
    });
  }

  /**
   * Get the register string from the capacitor storage
   * @returns The register string
   */
  const getRegisterString = () => {
    return Preferences.get({
      key: 'registerString'
    });
  }

  /**
   * Delete the register string from the capacitor storage
   */
  const deleteRegisterString = async () => {
    await Preferences.remove({
      key: 'registerString'
    });
  }

  /**
   * Perform the registration
   * @param registrationData 
   * @returns 
   */

  const performRegistration = async (registrationData: RegisterData) => {
    let hasErrors = false;
    const errors = ref({
      username: '',
      email: '',
      password: '',
      confirm_password: '',
      terms_accepted: '',
      general: ''
    });

    // validate form inputs
    if (!registrationData.username.trim()) {
      errors.value.username = t('registration.errors.displayNameRequired');
      hasErrors = true;
    }
  
    if (!registrationData.email.trim()) {
      errors.value.email = t('registration.errors.emailRequired');
      hasErrors = true;
    } else if (!isValidEmail(registrationData.email.trim())) {
      errors.value.email = t('registration.errors.emailInvalid');
      hasErrors = true;
    }
  
    if (!registrationData.password) {
      errors.value.password = t('registration.errors.passwordRequired');
      hasErrors = true;
    } else if (!isPasswordValid(registrationData.password)) {
      errors.value.password = t('registration.errors.passwordRequirements');
      hasErrors = true;
    }
  
    if (!registrationData.confirm_password) {
      errors.value.confirm_password = t('registration.errors.confirmPasswordRequired');
      hasErrors = true;
    }
  
    if (registrationData.password !== registrationData.confirm_password) {
      errors.value.confirm_password = t('registration.errors.passwordMismatch');
      hasErrors = true;
    }

    if (!registrationData.terms_accepted) {
      errors.value.terms_accepted = t('registration.errors.termsRequired');
      hasErrors = true;
    }
  
    if (hasErrors) {
      return {
        hasErrors: true,
        errors: errors.value,
        response: null
      };
    }
  
    try {
      const registerString = await getRegisterString();
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: registrationData.username.trim(),
          email: registrationData.email.trim(),
          password: registrationData.password,
          family_group_code: registerString.value,
          terms_accepted: registrationData.terms_accepted
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const errorBody = body?.data ?? body;

        if (response.status === 409) {
          // Deliberately vague between username and email to limit
          // account-enumeration value while staying helpful
          errors.value.general = t('registration.errors.duplicateAccount');
        } else if (
          response.status === 403 &&
          errorBody?.code === 'ENTITLEMENT_REQUIRED' &&
          errorBody?.feature === 'family_members'
        ) {
          errors.value.general = t('registrationStep2.familyGroupFull');
        } else if (response.status === 400 && body?.message) {
          errors.value.general = body.message;
        } else {
          errors.value.general = t('registration.errors.failed');
        }

        return {
          response,
          hasErrors: true,
          errors: errors.value
        };
      }

      return {
        response,
        hasErrors: false,
        errors: errors.value
      };
    } catch (error) {
      console.error('Error registering user:', error);
      errors.value.general = t('registration.errors.failed');
      return {
        response: null,
        hasErrors: true,
        errors: errors.value
      };
    }
  }

  return {
    storeRegisterString,
    getRegisterString,
    deleteRegisterString,
    performRegistration,
  }
}
