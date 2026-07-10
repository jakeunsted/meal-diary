import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput } from 'react-native';

import { GoogleSignInSection } from '@/components/auth/GoogleSignInSection';

import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { getPostAuthRoute } from '@/lib/auth/helpers';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const user = useAuthStore((state) => state.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await login(email.trim(), password);
      const currentUser = useAuthStore.getState().user ?? user;
      router.replace(getPostAuthRoute(currentUser));
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : t('login.networkError')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-base"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <Heading size="2xl" className="text-ice mb-1 text-center">
          {t('login.title')}
        </Heading>
        <Text className="text-ice/60 mb-8 text-center">{t('login.subtitle')}</Text>

        <Box className="gap-4">
          <Box>
            <Text className="text-ice/80 mb-2 text-sm">{t('login.email')}</Text>
            <TextInput
              className="rounded-lg bg-surface px-4 py-3 text-ice"
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              testID="login-email-input"
            />
          </Box>

          <Box>
            <Text className="text-ice/80 mb-2 text-sm">{t('login.password')}</Text>
            <TextInput
              className="rounded-lg bg-surface px-4 py-3 text-ice"
              placeholder={t('login.passwordPlaceholder')}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              testID="login-password-input"
            />
          </Box>

          {errorMessage && (
            <Box className="rounded-lg bg-red-500/15 px-4 py-3">
              <Text className="text-red-400">{errorMessage}</Text>
            </Box>
          )}

          <Button
            size="lg"
            className="mt-2"
            disabled={!canSubmit}
            onPress={handleLogin}
            testID="login-submit-button"
          >
            {isSubmitting && <ButtonSpinner color="#F1F5F9" />}
            <ButtonText>{t('login.signIn')}</ButtonText>
          </Button>

          <GoogleSignInSection
            label={t('login.signInWithGoogle')}
            showLegal
            disabled={isSubmitting}
            testID="google-login-button"
            onSuccess={() => {
              const currentUser = useAuthStore.getState().user ?? user;
              router.replace(getPostAuthRoute(currentUser));
            }}
          />

          <Box className="mt-6 flex-row flex-wrap justify-center gap-1">
            <Text className="text-sm text-ice/60">{t('login.noAccount')}</Text>
            <Link href="/(auth)/registration/step-1" asChild>
              <Pressable>
                <Text className="text-sm text-primary">{t('login.register')}</Text>
              </Pressable>
            </Link>
          </Box>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
