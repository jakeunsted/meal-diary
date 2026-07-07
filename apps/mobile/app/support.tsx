import { Linking, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FaqList } from '@/components/legal/FaqList';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { supportPage } from '@/lib/i18n/legalContent';

export default function SupportScreen() {
  const { t } = useTranslation();

  return (
    <LegalPageShell title={t('legal.support')}>
      <Text className="text-ice/80 mb-6 leading-relaxed">{supportPage.intro}</Text>

      <Box className="mb-8 rounded-2xl bg-surface p-5">
        <Heading size="md" className="text-ice mb-2">
          {t('legal.contactUs')}
        </Heading>
        <Text className="text-ice/80 mb-3">{supportPage.contactBody}</Text>
        <Pressable
          onPress={() => void Linking.openURL(`mailto:${t('legal.supportEmail')}`)}
          accessibilityRole="link"
          testID="support-email"
        >
          <Text className="text-primary text-lg underline">{t('legal.supportEmail')}</Text>
        </Pressable>
      </Box>

      <Heading size="md" className="text-ice mb-4">
        {supportPage.faqTitle}
      </Heading>

      <FaqList faqs={supportPage.faqs} />
    </LegalPageShell>
  );
}
