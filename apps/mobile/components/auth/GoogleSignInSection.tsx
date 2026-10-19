import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GoogleIcon } from '@/components/auth/GoogleIcon';
import { AuthOrDivider, SocialAuthLegal } from '@/components/auth/SocialAuthLegal';
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
  /** Where to place the OR divider relative to the Google button. Default: above (legacy). */
  dividerPosition?: 'above' | 'below' | 'none';
  onSuccess: () => void | Promise<void>;
  onError?: () => void;
  testID?: string;
}

function GoogleSignInSectionContent({
  label,
  showLegal = false,
  disabled = false,
  dividerPosition = 'above',
  onSuccess,
  onError,
  testID = 'google-sign-in-button',
}: GoogleSignInSectionProps) {
  const { signInWithGoogle, isLoading, error } = useGoogleAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      await onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (!message.includes('cancel')) {
        onError?.();
      }
    }
  };

  const isDisabled = disabled || isLoading;

  return (
    <Box className="gap-4">
      {dividerPosition === 'above' ? <AuthOrDivider /> : null}

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

      {showLegal ? <SocialAuthLegal /> : null}

      {dividerPosition === 'below' ? <AuthOrDivider /> : null}
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
