import { useEffect, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';

import type { AppleSignInSectionProps } from '@/components/auth/appleSignInSectionProps';
import { AuthOrDivider, SocialAuthLegal } from '@/components/auth/SocialAuthLegal';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { useAppleAuth } from '@/lib/auth/useAppleAuth';

function AppleSignInSectionContent({
  label,
  buttonType,
  showLegal = false,
  disabled = false,
  dividerPosition = 'none',
  onSuccess,
  testID = 'apple-sign-in-button',
}: AppleSignInSectionProps) {
  const { t } = useTranslation();
  const { signInWithApple, isLoading, error } = useAppleAuth();

  const handleAppleSignIn = async () => {
    if (disabled || isLoading) {
      return;
    }

    try {
      await signInWithApple();
      await onSuccess();
    } catch {
      // Cancel and error state are handled in the hook
    }
  };

  const isDisabled = disabled || isLoading;

  return (
    <Box className="gap-4">
      {dividerPosition === 'above' ? <AuthOrDivider /> : null}

      <Box
        className={isDisabled ? 'opacity-50' : undefined}
        pointerEvents={isDisabled ? 'none' : 'auto'}
      >
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            buttonType === 'sign-up'
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={8}
          style={{ width: '100%', height: 48 }}
          onPress={handleAppleSignIn}
          accessibilityLabel={label}
          testID={testID}
        />
      </Box>

      {error ? (
        <Box className="rounded-lg bg-red-500/15 px-4 py-3">
          <Text className="text-red-400 text-center text-sm">{error || t('login.appleFailed')}</Text>
        </Box>
      ) : null}

      {showLegal ? <SocialAuthLegal /> : null}

      {dividerPosition === 'below' ? <AuthOrDivider /> : null}
    </Box>
  );
}

export function AppleSignInSection(props: AppleSignInSectionProps) {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (!cancelled) {
          setIsAvailable(available);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAvailable) {
    return null;
  }

  return <AppleSignInSectionContent {...props} />;
}
