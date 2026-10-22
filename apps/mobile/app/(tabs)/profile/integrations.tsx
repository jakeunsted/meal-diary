import { FEATURE_FLAGS } from '@meal-diary/shared';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlexaIntegrationCard } from '@/components/profile/AlexaIntegrationCard';
import { Box } from '@/components/ui/box';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { Text } from '@/components/ui/text';
import { useFeatureFlag } from '@/lib/feature-flags/useFeatureFlag';
import { useCurrentUser } from '@/lib/queries/profile';

export default function IntegrationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const alexaEnabled = useFeatureFlag(FEATURE_FLAGS.alexaConnection);

  return (
    <Box className="flex-1 bg-base" testID="integrations-screen">
      <ScrollView
        contentContainerClassName="pb-8"
        contentContainerStyle={{ paddingTop: insets.top + 24 }}
      >
        <Box className="mx-4 mb-6">
          <Pressable
            accessibilityRole="button"
            className="mb-4 flex-row items-center gap-2 py-2 self-start"
            onPress={() => router.back()}
            testID="integrations-back"
          >
            <FontAwesome name="chevron-left" size={14} color="#F1F5F9" />
            <Text className="text-ice">{t('common.back')}</Text>
          </Pressable>
          <ScreenTitle align="left" className="mb-0">
            {t('integrations.title')}
          </ScreenTitle>
          <Text className="text-ice/70 mt-2 text-sm">{t('integrations.description')}</Text>
        </Box>

        {familyGroupId == null ? (
          <Text className="text-ice/70 mx-4 text-sm">{t('integrations.familyRequired')}</Text>
        ) : !alexaEnabled ? (
          <Text className="text-ice/70 mx-4 text-sm" testID="integrations-empty">
            {t('integrations.empty')}
          </Text>
        ) : (
          <Box testID="integrations-list">
            <AlexaIntegrationCard familyGroupId={familyGroupId} />
          </Box>
        )}
      </ScrollView>
    </Box>
  );
}
