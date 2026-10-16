import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { DialogPanel, dialogBackdropStyle } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useAnalyticsConsent } from '@/lib/analytics/consent';

const LEGAL_ROUTES = new Set(['/privacy', '/terms', '/support']);

export function AnalyticsConsentModal() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { loaded, choice, grant, deny } = useAnalyticsConsent();
  const [isSaving, setIsSaving] = useState(false);

  const visible = loaded && choice === null && !LEGAL_ROUTES.has(pathname);

  const handleChoose = (update: () => Promise<void>) => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    void update().finally(() => setIsSaving(false));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => undefined}
      testID="analytics-consent-modal"
      accessibilityViewIsModal
    >
      <View className="flex-1 items-center justify-center px-6">
        <View style={[StyleSheet.absoluteFill, dialogBackdropStyle]} />
        <DialogPanel>
          <Heading size="md" className="text-ice mb-2">
            {t('analyticsConsent.title')}
          </Heading>
          <Text className="text-ice/80 text-sm leading-relaxed">
            {t('analyticsConsent.body')}
          </Text>
          <Pressable
            onPress={() => router.push('/privacy')}
            accessibilityRole="link"
            className="mt-3"
            testID="analytics-consent-privacy"
          >
            <Text className="text-primary text-sm underline">
              {t('analyticsConsent.privacyPolicy')}
            </Text>
          </Pressable>

          <Box className="mt-6 w-full flex-row gap-3">
            <Box className="flex-1">
              <Button
                variant="secondary"
                className="w-full border border-border"
                disabled={isSaving}
                onPress={() => handleChoose(deny)}
                testID="analytics-consent-deny"
              >
                <ButtonText>{t('analyticsConsent.deny')}</ButtonText>
              </Button>
            </Box>
            <Box className="flex-1">
              <Button
                variant="default"
                className="w-full"
                disabled={isSaving}
                onPress={() => handleChoose(grant)}
                testID="analytics-consent-allow"
              >
                <ButtonText>{t('analyticsConsent.allow')}</ButtonText>
              </Button>
            </Box>
          </Box>
        </DialogPanel>
      </View>
    </Modal>
  );
}
