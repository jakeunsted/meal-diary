import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';

export function AuthOrDivider() {
  const { t } = useTranslation();

  return (
    <Box className="flex-row items-center gap-3">
      <Box className="h-px flex-1 bg-white/10" />
      <Text className="text-ice/60 text-sm">{t('login.or')}</Text>
      <Box className="h-px flex-1 bg-white/10" />
    </Box>
  );
}

export function SocialAuthLegal() {
  const { t } = useTranslation();

  const handleOpenTerms = () => {
    void Linking.openURL(`${env.webUrl}/terms`);
  };

  const handleOpenPrivacy = () => {
    void Linking.openURL(`${env.webUrl}/privacy`);
  };

  return (
    <Text className="text-center text-sm leading-5 text-ice/60">
      {t('login.socialLegalPrefix')}{' '}
      <Text className="text-primary underline" onPress={handleOpenTerms}>
        {t('registration.termsOfService')}
      </Text>{' '}
      {t('registration.and')}{' '}
      <Text className="text-primary underline" onPress={handleOpenPrivacy}>
        {t('registration.privacyPolicy')}
      </Text>
    </Text>
  );
}
