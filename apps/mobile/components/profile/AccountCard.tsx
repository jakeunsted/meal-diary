import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { saveDataExport } from '@/lib/account/saveDataExport';
import { ApiError } from '@/lib/api/client';
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
