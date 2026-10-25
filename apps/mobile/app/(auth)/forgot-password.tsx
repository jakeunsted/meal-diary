import { isValidEmail } from '@meal-diary/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ApiError, apiFetch } from '@/lib/api/client';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage(t('passwordReset.invalidEmail'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: { email: trimmedEmail },
      });
      setSubmitted(true);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : t('passwordReset.unableToSend')
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
          {t('passwordReset.title')}
        </Heading>
        <Text className="text-ice/60 mb-8 text-center">{t('passwordReset.instructions')}</Text>

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
              editable={!isSubmitting && !submitted}
              testID="forgot-password-email-input"
            />
          </Box>

          {errorMessage && (
            <Box className="rounded-lg bg-red-500/15 px-4 py-3" testID="forgot-password-error">
              <Text className="text-red-400">{errorMessage}</Text>
            </Box>
          )}

          {submitted && (
            <Box className="rounded-lg bg-green-500/15 px-4 py-3" testID="forgot-password-success">
              <Text className="text-green-300">{t('passwordReset.sent')}</Text>
            </Box>
          )}

          <Button
            size="lg"
            className="mt-2"
            disabled={isSubmitting || submitted}
            onPress={handleForgotPassword}
            testID="forgot-password-submit-button"
          >
            {isSubmitting && <ButtonSpinner color="#F1F5F9" />}
            <ButtonText>{t('passwordReset.sendLink')}</ButtonText>
          </Button>

          <Box className="mt-4 items-center">
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text className="text-sm text-primary">{t('passwordReset.backToLogin')}</Text>
              </Pressable>
            </Link>
          </Box>
        </Box>
      </KeyboardAwareScrollView>
    </Box>
  );
}
