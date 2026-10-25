import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PasswordAccountLinkForm } from '@/components/auth/PasswordAccountLinkForm';

import type { AppleSignInSectionProps } from '@/components/auth/appleSignInSectionProps';
import { AuthOrDivider, SocialAuthLegal } from '@/components/auth/SocialAuthLegal';
import { Box } from '@/components/ui/box';
import { ButtonSpinner } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';
import { isAppleWebCancel } from '@/lib/auth/appleWeb';
import { PasswordLinkRequired } from '@/lib/auth/passwordLink';
import { useAppleAuth } from '@/lib/auth/useAppleAuth.web';

function AppleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="#000000">
      <Path d="M16.365 1.43c0 1.14-.417 2.2-1.246 3.18-.96 1.14-2.12 1.8-3.39 1.7-.12-1.1.42-2.26 1.2-3.18.86-1.02 2.34-1.78 3.436-1.7zM20.7 17.1c-.54 1.24-.8 1.8-1.5 2.9-.98 1.54-2.36 3.46-4.07 3.48-1.52.02-1.91-.99-3.97-1-2.06 0-2.5 1.02-4.02.98-1.71-.04-3.02-1.76-4-3.3-2.74-4.28-3.03-9.3-1.34-11.96 1.2-1.88 3.1-2.98 4.88-2.98 1.82 0 2.96 1 4.47 1 1.47 0 2.36-1 4.46-1 1.58 0 3.26.86 4.46 2.35-3.92 2.15-3.28 7.74.63 9.53z" />
    </Svg>
  );
}

export function AppleSignInSection({
  label,
  showLegal = false,
  disabled = false,
  dividerPosition = 'none',
  onSuccess,
  onError,
  testID = 'apple-sign-in-button',
}: AppleSignInSectionProps) {
  const { t } = useTranslation();
  const { signInWithApple, isLoading, error } = useAppleAuth();
  const [linkToken, setLinkToken] = useState<string | null>(null);

  if (!env.isAppleWebConfigured) {
    return null;
  }

  const handleAppleSignIn = async () => {
    if (disabled || isLoading) {
      return;
    }

    try {
      await signInWithApple();
      await onSuccess();
    } catch (err) {
      if (err instanceof PasswordLinkRequired) {
        setLinkToken(err.linkToken);
        return;
      }
      if (isAppleWebCancel(err)) {
        return;
      }
      onError?.();
    }
  };

  const isDisabled = disabled || isLoading;

  return (
    <Box className="gap-4">
      {dividerPosition === 'above' ? <AuthOrDivider /> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={isDisabled}
        onPress={handleAppleSignIn}
        testID={testID}
        className={`h-12 w-full flex-row items-center justify-center gap-3 rounded-lg bg-white ${isDisabled ? 'opacity-50' : ''}`}
      >
        {isLoading ? <ButtonSpinner color="#000000" /> : <AppleIcon />}
        <Text className="text-base font-semibold text-black">{label}</Text>
      </Pressable>

      {linkToken ? (
        <PasswordAccountLinkForm linkToken={linkToken} onSuccess={onSuccess} />
      ) : null}

      {error && !linkToken ? (
        <Box className="rounded-lg bg-red-500/15 px-4 py-3">
          <Text className="text-red-400 text-center text-sm">{error || t('login.appleFailed')}</Text>
        </Box>
      ) : null}

      {showLegal ? <SocialAuthLegal /> : null}

      {dividerPosition === 'below' ? <AuthOrDivider /> : null}
    </Box>
  );
}
