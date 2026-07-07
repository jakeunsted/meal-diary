import { Linking, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { LegalSectionList } from '@/components/legal/LegalSectionList';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { termsPage } from '@/lib/i18n/legalContent';

export default function TermsScreen() {
  const { t } = useTranslation();

  return (
    <LegalPageShell title={t('legal.termsOfService')}>
      <Text className="text-ice/70 mb-6 text-sm">
        {t('legal.lastUpdated')}: {termsPage.lastUpdated}
      </Text>

      <Text className="text-ice/80 mb-6 leading-relaxed">{termsPage.intro}</Text>

      <LegalSectionList sections={termsPage.sections} />

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
