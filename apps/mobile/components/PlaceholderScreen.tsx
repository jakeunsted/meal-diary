import type { EntitlementFeature } from '@meal-diary/shared';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { Text } from '@/components/ui/text';

interface PlaceholderScreenProps {
  titleKey: 'screens.diary' | 'screens.recipes' | 'screens.shoppingList' | 'screens.profile' | 'screens.login';
  /** Verifies @meal-diary/shared resolves in the monorepo */
  entitlementFeature?: EntitlementFeature;
}

export function PlaceholderScreen({ titleKey, entitlementFeature = 'weeks_ahead' }: PlaceholderScreenProps) {
  const { t } = useTranslation();

  return (
    <Box className="flex-1 items-center justify-center bg-base px-6">
      <ScreenTitle className="mb-2">{t(titleKey)}</ScreenTitle>
      <Text className="text-violet mb-6 text-center">
        {t('screens.comingSoon')}
      </Text>
      <Button variant="default">
        <ButtonText>{entitlementFeature.replace('_', ' ')}</ButtonText>
      </Button>
    </Box>
  );
}
