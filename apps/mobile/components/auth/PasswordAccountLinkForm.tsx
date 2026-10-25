import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { completeOAuthAccountLink } from '@/lib/auth/completeOAuthAccountLink';

interface PasswordAccountLinkFormProps {
  linkToken: string;
  onSuccess: () => void | Promise<void>;
}

export function PasswordAccountLinkForm({ linkToken, onSuccess }: PasswordAccountLinkFormProps) {
  const { t } = useTranslation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!password || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await completeOAuthAccountLink(linkToken, password, setAuth);
      await onSuccess();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('login.passwordLinkFailed')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box className="gap-3">
      <Text className="text-ice text-center text-sm">{t('login.passwordLinkExplanation')}</Text>
      <TextInput
        className="rounded-lg bg-base px-4 py-3 text-ice"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={t('login.passwordPlaceholder')}
        placeholderTextColor="#94A3B8"
        editable={!isSubmitting}
        testID="oauth-link-password"
      />
      {error ? (
        <Text className="text-red-400 text-center text-sm" testID="oauth-link-error">
          {error}
        </Text>
      ) : null}
      <Button
        disabled={!password || isSubmitting}
        onPress={handleConfirm}
        testID="oauth-link-submit"
      >
        {isSubmitting ? <ButtonSpinner color="#F1F5F9" /> : null}
        <ButtonText>{t('login.linkAccount')}</ButtonText>
      </Button>
    </Box>
  );
}
