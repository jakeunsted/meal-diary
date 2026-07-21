import { Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GoogleIcon } from '@/components/auth/GoogleIcon';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';
import { isGoogleWebSignInAvailable } from '@/lib/auth/googleRedirectUri';
import { isNativeGoogleSignInAvailable } from '@/lib/auth/isNativeGoogleSignInAvailable';
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
        <Text className="text-center text-sm leading-5 text-ice/60">
          {t('login.googleLegalPrefix')}{' '}
          <Text className="text-primary underline" onPress={handleOpenTerms}>
            {t('registration.termsOfService')}
          </Text>{' '}
          {t('registration.and')}{' '}
          <Text className="text-primary underline" onPress={handleOpenPrivacy}>
            {t('registration.privacyPolicy')}
          </Text>
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

  if (Platform.OS !== 'web' && !isNativeGoogleSignInAvailable()) {
    return (
      <Box className="rounded-lg border border-warning/40 bg-warning/15 px-4 py-3">
        <Text className="text-ice text-center text-sm">
          {t('login.googleRequiresDevBuild')}
        </Text>
      </Box>
    );
  }

  if (!isGoogleWebSignInAvailable()) {
    return (
      <Box className="rounded-lg border border-warning/40 bg-warning/15 px-4 py-3">
        <Text className="text-ice text-center text-sm">
          {t('login.googleRequiresSecureOrigin')}
        </Text>
      </Box>
    );
  }

  return <GoogleSignInSectionContent {...props} />;
}
