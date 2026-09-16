import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalLinks } from '@/components/legal/LegalLinks';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { ScreenTitle } from '@/components/ui/ScreenTitle';

interface LegalPageShellProps {
  title: string;
  children: ReactNode;
}

export function LegalPageShell({ title, children }: LegalPageShellProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(auth)/login');
  };

  return (
    <Box className="flex-1 bg-base">
      <ScrollView
        contentContainerClassName="pb-8"
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 16 }}
      >
        <Box className="mb-2 flex-row items-center justify-between">
          <ScreenTitle align="left" className="mb-0 flex-1">
            {title}
          </ScreenTitle>
          <Button variant="ghost" size="sm" onPress={handleBack} testID="back-button">
            <ButtonText>{t('common.back')}</ButtonText>
          </Button>
        </Box>

        {children}

        <LegalLinks className="mt-8" />
      </ScrollView>
    </Box>
  );
}
