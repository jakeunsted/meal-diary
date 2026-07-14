import { Linking, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FaqList } from '@/components/legal/FaqList';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { LegalSectionList } from '@/components/legal/LegalSectionList';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { privacyPage } from '@meal-diary/shared';
const ICO_COMPLAINT_URL = 'https://ico.org.uk/make-a-complaint/';

export default function PrivacyScreen() {
  const { t } = useTranslation();

  const handleOpenIco = () => {
    void Linking.openURL(ICO_COMPLAINT_URL);
  };

  return (
    <LegalPageShell title={t('legal.privacyPolicy')}>
      <Text className="text-ice/70 mb-6 text-sm">
        {t('legal.lastUpdated')}: {privacyPage.lastUpdated}
      </Text>

      <Text className="text-ice/80 mb-6 leading-relaxed">{privacyPage.intro}</Text>

      <LegalSectionList sections={privacyPage.sections} />

      <Box className="mb-6">
        <Heading size="md" className="text-ice mb-2">
          {privacyPage.complaintsTitle}
        </Heading>
        <Text className="text-ice/80 mb-2 leading-relaxed">{privacyPage.complaintsBody}</Text>
        <Pressable onPress={handleOpenIco} accessibilityRole="link">
          <Text className="text-primary underline">ico.org.uk/make-a-complaint</Text>
        </Pressable>
      </Box>

      <Box className="mb-6">
        <Heading size="md" className="text-ice mb-2">
          {t('legal.contactUs')}
        </Heading>
        <Pressable
          onPress={() => void Linking.openURL(`mailto:${t('legal.supportEmail')}`)}
          accessibilityRole="link"
        >
          <Text className="text-primary underline">{t('legal.supportEmail')}</Text>
        </Pressable>
      </Box>
    </LegalPageShell>
  );
}
