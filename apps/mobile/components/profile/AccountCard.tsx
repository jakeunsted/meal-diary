import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/auth/authStore';

export function AccountCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/(auth)/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <ProfileCard title={t('profile.accountTitle')}>
      <Text className="text-ice/70 mb-4 text-sm">{t('profile.accountDescription')}</Text>
      <Button
        variant="destructive"
        className="self-start"
        disabled={isLoggingOut}
        onPress={handleLogout}
        testID="profile-logout-button"
      >
        {isLoggingOut && <ButtonSpinner color="#F1F5F9" />}
        <ButtonText>{t('profile.logout')}</ButtonText>
      </Button>
    </ProfileCard>
  );
}
