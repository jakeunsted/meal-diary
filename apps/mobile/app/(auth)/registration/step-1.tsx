import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { GoogleSignInSection } from '@/components/auth/GoogleSignInSection';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { getPostAuthRoute } from '@/lib/auth/helpers';
import {
  clearRegisterCode,
  getRegisterCode,
  storeRegisterCode,
} from '@/lib/auth/registerStorage';
import {
  emptyRegisterErrors,
  validateRegisterForm,
  type RegisterFieldErrors,
} from '@/lib/auth/registerValidation';
import { registerUser } from '@/lib/queries/family';

function FieldError({ message }: { message: string }) {
  if (!message) return null;
  return <Text className="text-red-400 mt-1 text-sm">{message}</Text>;
}

export default function RegistrationStep1Screen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const login = useAuthStore((state) => state.login);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<RegisterFieldErrors>(emptyRegisterErrors());

  useEffect(() => {
    if (typeof code === 'string' && code.length > 0) {
      void storeRegisterCode(code);
    }
  }, [code]);

  const handleOpenTerms = () => {
    void Linking.openURL(`${env.webUrl}/terms`);
  };

  const handleOpenPrivacy = () => {
    void Linking.openURL(`${env.webUrl}/privacy`);
  };

  const handleRegistration = async () => {
    const validation = validateRegisterForm(
      {
        username,
        email,
        first_name: firstName,
        last_name: lastName,
        password,
        confirm_password: confirmPassword,
        terms_accepted: termsAccepted,
      },
      t
    );

    if (validation.hasErrors) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    setErrors(emptyRegisterErrors());

    try {
      const familyGroupCode = (await getRegisterCode()) ?? undefined;

      await registerUser({
        username: username.trim(),
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
        terms_accepted: termsAccepted,
        family_group_code: familyGroupCode,
      });

      await clearRegisterCode();
      await login(email.trim(), password);

      const user = useAuthStore.getState().user;
      router.replace(getPostAuthRoute(user));
    } catch (error) {
      const nextErrors = emptyRegisterErrors();

      if (error instanceof ApiError) {
        if (error.status === 409) {
          nextErrors.general = t('registration.errors.duplicateAccount');
        } else if (
          error.status === 403 &&
          error.code === 'ENTITLEMENT_REQUIRED' &&
          error.feature === 'family_members'
        ) {
          nextErrors.general = t('registrationStep2.familyGroupFull');
        } else if (error.status === 400) {
          nextErrors.general = error.message;
        } else if (error.status === 404) {
          nextErrors.general = error.message;
        } else {
          nextErrors.general = t('registration.errors.failed');
        }
      } else {
        nextErrors.general = t('registration.errors.failed');
      }

      setErrors(nextErrors);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClassName = 'rounded-lg bg-surface px-4 py-3 text-ice';

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-base"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <Heading size="2xl" className="text-ice mb-6 text-center">
          {t('registration.title')}
        </Heading>

        <Box className="gap-4">
          <Box>
            <Text className="text-ice/80 mb-2 text-sm">{t('registration.username')}</Text>
            <TextInput
              className={inputClassName}
              placeholder={t('registration.usernamePlaceholder')}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              editable={!isSubmitting}
              testID="register-username-input"
            />
            <FieldError message={errors.username} />
          </Box>

          <Box>
            <Text className="text-ice/80 mb-2 text-sm">{t('registration.email')}</Text>
            <TextInput
              className={inputClassName}
              placeholder={t('registration.emailPlaceholder')}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!isSubmitting}
              testID="register-email-input"
            />
            <FieldError message={errors.email} />
          </Box>

          <Box>
            <Text className="text-ice/80 mb-2 text-sm">{t('registration.firstName')}</Text>
            <TextInput
              className={inputClassName}
              placeholder={t('registration.firstNamePlaceholder')}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              value={firstName}
              onChangeText={setFirstName}
              editable={!isSubmitting}
              testID="register-first-name-input"
            />
            <FieldError message={errors.first_name} />
          </Box>

          <Box>
            <Text className="text-ice/80 mb-2 text-sm">{t('registration.lastName')}</Text>
            <TextInput
              className={inputClassName}
              placeholder={t('registration.lastNamePlaceholder')}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              value={lastName}
              onChangeText={setLastName}
              editable={!isSubmitting}
              testID="register-last-name-input"
            />
            <FieldError message={errors.last_name} />
          </Box>

          <Box>
            <Text className="text-ice/80 mb-2 text-sm">{t('registration.password')}</Text>
            <TextInput
              className={inputClassName}
              placeholder={t('registration.passwordPlaceholder')}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isSubmitting}
              testID="register-password-input"
            />
            <FieldError message={errors.password} />
          </Box>

          <Box>
            <Text className="text-ice/80 mb-2 text-sm">{t('registration.confirmPassword')}</Text>
            <TextInput
              className={inputClassName}
              placeholder={t('registration.confirmPasswordPlaceholder')}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!isSubmitting}
              testID="register-confirm-password-input"
            />
            <FieldError message={errors.confirm_password} />
          </Box>

          <Text className="text-ice/60 text-sm">{t('registration.ageRequirement')}</Text>

          <Pressable
            className="flex-row items-start gap-3"
            onPress={() => setTermsAccepted((value) => !value)}
            disabled={isSubmitting}
            testID="terms-checkbox"
          >
            <Box
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
                termsAccepted ? 'border-primary bg-primary' : 'border-ice/40 bg-transparent'
              }`}
            >
              {termsAccepted ? <Text className="text-ice text-xs">✓</Text> : null}
            </Box>
            <Text className="text-ice/80 flex-1 text-sm">
              {t('registration.termsPrefix')}{' '}
              <Text className="text-primary underline" onPress={handleOpenTerms}>
                {t('registration.termsOfService')}
              </Text>{' '}
              {t('registration.and')}{' '}
              <Text className="text-primary underline" onPress={handleOpenPrivacy}>
                {t('registration.privacyPolicy')}
              </Text>
            </Text>
          </Pressable>
          <FieldError message={errors.terms_accepted} />

          {errors.general ? (
            <Box className="rounded-lg bg-red-500/15 px-4 py-3">
              <Text className="text-red-400 text-center">{errors.general}</Text>
            </Box>
          ) : null}

          <Button
            size="lg"
            className="mt-2"
            disabled={isSubmitting}
            onPress={handleRegistration}
            testID="register-submit-button"
          >
            {isSubmitting && <ButtonSpinner color="#F1F5F9" />}
            <ButtonText>{t('registration.register')}</ButtonText>
          </Button>

          <GoogleSignInSection
            label={t('registration.signUpWithGoogle')}
            showLegal
            disabled={isSubmitting}
            testID="google-signup-button"
            onSuccess={() => {
              const currentUser = useAuthStore.getState().user;
              router.replace(getPostAuthRoute(currentUser));
            }}
          />

          <Box className="mt-4 flex-row justify-center gap-1">
            <Text className="text-ice/60">{t('registration.alreadyHaveAccount')}</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text className="text-primary">{t('registration.signIn')}</Text>
              </Pressable>
            </Link>
          </Box>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
