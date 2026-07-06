import type { EntitlementFeature } from '@meal-diary/shared';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
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
      <Heading size="2xl" className="text-ice mb-2">
        {t(titleKey)}
      </Heading>
      <Text className="text-violet mb-6 text-center">
        {t('screens.comingSoon')}
      </Text>
      <Button variant="default">
        <ButtonText>{entitlementFeature.replace('_', ' ')}</ButtonText>
      </Button>
    </Box>
  );
}
