import { Preferences } from '@capacitor/preferences';

interface RegisterData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirm_password: string;
  hasErrors: boolean;
}

export const useRegister = () => {
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
      first_name: '',
      last_name: '',
      password: '',
      confirm_password: '',
      general: ''
    });

    // validate form inputs
    if (!registrationData.username) {
      errors.value.username = 'Username is required';
      hasErrors = true;
    }
  
    if (!registrationData.email) {
      errors.value.email = 'Email is required';
      hasErrors = true;
    }
  
    if (!registrationData.first_name) {
      errors.value.first_name = 'First name is required';
      hasErrors = true;
    }
  
    if (!registrationData.last_name) {
      errors.value.last_name = 'Last name is required';
      hasErrors = true;
    }
  
    if (!registrationData.password) {
      errors.value.password = 'Password is required';
      hasErrors = true;
    }
  
    if (!registrationData.confirm_password) {
      errors.value.confirm_password = 'You need to confirm your password';
      hasErrors = true;
    }
  
    if (registrationData.password !== registrationData.confirm_password) {
      errors.value.confirm_password = 'Passwords do not match';
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
          username: registrationData.username, 
          email: registrationData.email, 
          first_name: registrationData.first_name, 
          last_name: registrationData.last_name, 
          password: registrationData.password,
          family_group_code: registerString.value
        }),
      });
  
      return {
        response,
        hasErrors: false,
        errors: errors.value
      };
    } catch (error) {
      console.error('Error registering user:', error);
      errors.value.general = 'Failed to register user';
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