import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';

interface LegalLinksProps {
  className?: string;
}

export function LegalLinks({ className }: LegalLinksProps) {
  const { t } = useTranslation();

  return (
    <Box className={`flex-row flex-wrap items-center justify-center gap-2 ${className ?? ''}`}>
      <Link href="/privacy" asChild>
        <Pressable testID="privacy-link">
          <Text className="text-ice/70 text-sm underline">{t('legal.privacyPolicy')}</Text>
        </Pressable>
      </Link>
      <Text className="text-ice/70 text-sm">·</Text>
      <Link href="/terms" asChild>
        <Pressable testID="terms-link">
          <Text className="text-ice/70 text-sm underline">{t('legal.termsOfService')}</Text>
        </Pressable>
      </Link>
      <Text className="text-ice/70 text-sm">·</Text>
      <Link href="/support" asChild>
        <Pressable testID="support-link">
          <Text className="text-ice/70 text-sm underline">{t('legal.support')}</Text>
        </Pressable>
      </Link>
    </Box>
  );
}
