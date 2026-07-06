import { Linking, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';

interface WarningAlertProps {
  message: string;
  showUpgradeLink?: boolean;
  className?: string;
  testID?: string;
}

export function WarningAlert({
  message,
  showUpgradeLink = false,
  className,
  testID,
}: WarningAlertProps) {
  const { t } = useTranslation();

  const handleOpenPlans = () => {
    void Linking.openURL(`${env.webUrl}/plans`);
  };

  return (
    <Box
      className={`rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 ${className ?? ''}`}
      testID={testID}
    >
      <Text className="text-warning-content text-sm">
        {message}
        {showUpgradeLink ? (
          <>
            {' '}
            <Pressable onPress={handleOpenPlans} accessibilityRole="link">
              <Text className="text-primary text-sm underline">
                {t('profile.viewPlansToUpgrade')}
              </Text>
            </Pressable>
          </>
        ) : null}
      </Text>
    </Box>
  );
}
