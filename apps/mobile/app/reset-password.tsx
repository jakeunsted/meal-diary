import { evaluatePassword, isPasswordValid } from '@meal-diary/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ApiError, apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';

const firstParam = (value: string | string[] | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return '';
};

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const clearSession = useAuthStore((state) => state.clearSession);
  const token = firstParam(params.token);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    token ? null : t('passwordReset.invalidLink')
  );

  const passwordRequirementResults = useMemo(() => evaluatePassword(password), [password]);

  const handleResetPassword = async () => {
    if (!token) {
      setErrorMessage(t('passwordReset.invalidLink'));
      return;
    }
    if (!isPasswordValid(password)) {
      setErrorMessage(t('passwordReset.requirements'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t('passwordReset.mismatch'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: { token, password },
      });
      await clearSession();
      router.replace('/(auth)/login');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : t('passwordReset.unableToReset')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box className="flex-1 bg-base">
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 48,
        }}
        keyboardShouldPersistTaps="handled"
        mode="layout"
        style={{ flex: 1 }}
      >
        <Heading size="2xl" className="text-ice mb-1 text-center">
          {t('passwordReset.resetTitle')}
        </Heading>
        <Text className="text-ice/60 mb-8 text-center">{t('passwordReset.choosePassword')}</Text>

        <Box className="gap-4">
          <Box>
            <Text className="text-ice/80 mb-2 text-sm">{t('passwordReset.newPassword')}</Text>
            <TextInput
              className="rounded-lg bg-surface px-4 py-3 text-ice"
              placeholder={t('login.passwordPlaceholder')}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
              editable={!isSubmitting && token.length > 0}
              testID="reset-password-input"
            />
            <Box className="mt-2 gap-1">
              {passwordRequirementResults.map((requirement) => (
                <Box key={requirement.id} className="flex-row items-center gap-2">
                  <Text className={`text-sm ${requirement.met ? 'text-green-400' : 'text-ice/50'}`}>
                    {requirement.met ? '✓' : '○'}
                  </Text>
                  <Text className={`text-sm ${requirement.met ? 'text-green-400' : 'text-ice/50'}`}>
                    {t(`registration.passwordRequirements.${requirement.id}`)}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>

          <Box>
            <Text className="text-ice/80 mb-2 text-sm">{t('passwordReset.confirmPassword')}</Text>
            <TextInput
              className="rounded-lg bg-surface px-4 py-3 text-ice"
              placeholder={t('registration.confirmPasswordPlaceholder')}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              secureTextEntry
              autoComplete="new-password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!isSubmitting && token.length > 0}
              testID="reset-confirm-password-input"
            />
          </Box>

          {errorMessage && (
            <Box className="rounded-lg bg-red-500/15 px-4 py-3" testID="reset-password-error">
              <Text className="text-red-400">{errorMessage}</Text>
            </Box>
          )}

          <Button
            size="lg"
            className="mt-2"
            disabled={isSubmitting || token.length === 0}
            onPress={handleResetPassword}
            testID="reset-password-submit-button"
          >
            {isSubmitting && <ButtonSpinner color="#F1F5F9" />}
            <ButtonText>{t('passwordReset.resetPassword')}</ButtonText>
          </Button>

          <Box className="mt-4 items-center">
            <Pressable onPress={() => router.replace('/(auth)/login')}>
              <Text className="text-sm text-primary">{t('passwordReset.backToLogin')}</Text>
            </Pressable>
          </Box>
        </Box>
      </KeyboardAwareScrollView>
    </Box>
  );
}
