import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch } from 'react-native';

import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { saveDataExport } from '@/lib/account/saveDataExport';
import { ApiError } from '@/lib/api/client';
import { useAnalyticsConsent } from '@/lib/analytics/consent';
import { useAuthStore } from '@/lib/auth/authStore';
import { exportUserData } from '@/lib/queries/account';

export function AccountCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);
  const { loaded: consentLoaded, choice, grant, deny } = useAnalyticsConsent();
  const analyticsEnabled = choice === 'granted';

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

  const handleAnalyticsChange = (enabled: boolean) => {
    if (!consentLoaded || isUpdatingConsent || enabled === analyticsEnabled) {
      return;
    }
    setIsUpdatingConsent(true);
    void (enabled ? grant() : deny()).finally(() => setIsUpdatingConsent(false));
  };

  const handleDownloadData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const bundle = await exportUserData();
      await saveDataExport(bundle, {
        dialogTitle: t('profile.account.saveDataTitle'),
      });
    } catch (err) {
      setExportError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('profile.account.exportFailed')
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <ProfileCard title={t('profile.accountTitle')}>
        <Text className="text-ice/70 mb-4 text-sm">{t('profile.accountDescription')}</Text>

        <Box className="mb-4 flex-row items-start justify-between gap-3">
          <Box className="flex-1">
            <Text className="text-ice text-sm">{t('analyticsConsent.profileLabel')}</Text>
            <Text className="text-ice/70 mt-1 text-sm">{t('analyticsConsent.profileDescription')}</Text>
            <Link href="/privacy" asChild>
              <Pressable accessibilityRole="link" testID="analytics-consent-privacy-link">
                <Text className="text-primary mt-1 text-sm underline">
                  {t('analyticsConsent.privacyPolicy')}
                </Text>
              </Pressable>
            </Link>
          </Box>
          <Switch
            value={analyticsEnabled}
            onValueChange={handleAnalyticsChange}
            disabled={!consentLoaded || isUpdatingConsent}
            trackColor={{ false: 'rgba(241, 245, 249, 0.2)', true: '#6366F1' }}
            thumbColor="#F1F5F9"
            accessibilityLabel={t('analyticsConsent.profileLabel')}
            testID="analytics-consent-switch"
          />
        </Box>

        <Box className="w-full gap-3">
          <Button
            variant="outline"
            className="w-full"
            disabled={isLoggingOut}
            onPress={handleLogout}
            testID="profile-logout-button"
          >
            {isLoggingOut && <ButtonSpinner color="#F1F5F9" />}
            <ButtonText>{t('profile.logout')}</ButtonText>
          </Button>

          <Box className="w-full flex-row flex-wrap gap-3">
            <Box className="min-w-[45%] flex-1">
              <Button
                variant="outline"
                className="w-full"
                disabled={isExporting}
                onPress={handleDownloadData}
                testID="download-data-button"
              >
                {isExporting ? (
                  <ButtonSpinner color="#F1F5F9" />
                ) : (
                  <ButtonText>{t('profile.account.downloadData')}</ButtonText>
                )}
              </Button>
            </Box>

            <Box className="min-w-[45%] flex-1">
              <Button
                variant="outline"
                className="w-full border-red-500/40"
                onPress={() => setIsDeleteModalVisible(true)}
                testID="delete-account-button"
              >
                <ButtonText className="text-red-400">{t('profile.account.deleteAccount')}</ButtonText>
              </Button>
            </Box>
          </Box>
        </Box>

        {exportError ? (
          <Box className="mt-4 rounded-lg bg-red-500/15 px-4 py-3">
            <Text className="text-red-400 text-sm">{exportError}</Text>
          </Box>
        ) : null}
      </ProfileCard>

      <DeleteAccountModal
        visible={isDeleteModalVisible}
        user={user}
        onClose={() => setIsDeleteModalVisible(false)}
      />
    </>
  );
}
