import { Linking, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GoogleIcon } from '@/components/auth/GoogleIcon';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';
import { isGoogleWebSignInAvailable } from '@/lib/auth/googleRedirectUri';
import { useGoogleAuth } from '@/lib/auth/useGoogleAuth';

interface GoogleSignInSectionProps {
  label: string;
  showLegal?: boolean;
  disabled?: boolean;
  onSuccess: () => void | Promise<void>;
  testID?: string;
}

function GoogleSignInSectionContent({
  label,
  showLegal = false,
  disabled = false,
  onSuccess,
  testID = 'google-sign-in-button',
}: GoogleSignInSectionProps) {
  const { t } = useTranslation();
  const { signInWithGoogle, isLoading, error } = useGoogleAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      await onSuccess();
    } catch {
      // Error state is handled in the hook
    }
  };

  const handleOpenTerms = () => {
    void Linking.openURL(`${env.webUrl}/terms`);
  };

  const handleOpenPrivacy = () => {
    void Linking.openURL(`${env.webUrl}/privacy`);
  };

  const isDisabled = disabled || isLoading;

  return (
    <Box className="gap-4">
      <Box className="flex-row items-center gap-3">
        <Box className="h-px flex-1 bg-white/10" />
        <Text className="text-ice/60 text-sm">{t('login.or')}</Text>
        <Box className="h-px flex-1 bg-white/10" />
      </Box>

      <Button
        variant="outline"
        size="lg"
        disabled={isDisabled}
        onPress={handleGoogleSignIn}
        testID={testID}
      >
        {isLoading ? <ButtonSpinner color="#F1F5F9" /> : <GoogleIcon />}
        <ButtonText>{label}</ButtonText>
      </Button>

      {error ? (
        <Box className="rounded-lg bg-red-500/15 px-4 py-3">
          <Text className="text-red-400 text-center text-sm">{error}</Text>
        </Box>
      ) : null}

      {showLegal ? (
        <Text className="text-ice/60 text-center text-xs">
          {t('login.googleLegalPrefix')}{' '}
          <Pressable
            className="items-center justify-start"
            onPress={handleOpenTerms}
            accessibilityRole="link"
          >
            <Text className="text-primary underline">{t('registration.termsOfService')}</Text>
          </Pressable>{' '}
          {t('registration.and')}{' '}
          <Pressable
            className="items-center justify-start"
            onPress={handleOpenPrivacy}
            accessibilityRole="link"
          >
            <Text className="text-primary underline">{t('registration.privacyPolicy')}</Text>
          </Pressable>
        </Text>
      ) : null}
    </Box>
  );
}

export function GoogleSignInSection(props: GoogleSignInSectionProps) {
  const { t } = useTranslation();

  if (!env.isGoogleConfigured) {
    return null;
  }

  if (!isGoogleWebSignInAvailable()) {
    return (
      <Box className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
        <Text className="text-warning-content text-center text-sm">
          {t('login.googleRequiresSecureOrigin')}
        </Text>
      </Box>
    );
  }

  return <GoogleSignInSectionContent {...props} />;
}
