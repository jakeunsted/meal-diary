import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useRecipeEntitlements } from '@/lib/entitlements/useRecipeEntitlements';
import { useCurrentUser, useEntitlements } from '@/lib/queries/profile';

export default function CreateRecipeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userQuery = useCurrentUser();
  const entitlementsQuery = useEntitlements(userQuery.data?.family_group_id);
  const recipeEntitlements = useRecipeEntitlements(entitlementsQuery.data);

  if (!recipeEntitlements.canCreateRecipe) {
    return <Redirect href="/(tabs)/recipes" />;
  }

  return (
    <Box className="flex-1 bg-base px-4" style={{ paddingTop: insets.top }}>
      <Pressable
        accessibilityRole="button"
        className="mb-4 flex-row items-center gap-2 py-2"
        onPress={() => router.back()}
      >
        <FontAwesome name="chevron-left" size={14} color="#F1F5F9" />
        <Text className="text-ice">{t('common.back')}</Text>
      </Pressable>

      <Heading className="text-ice" size="lg">
        {t('recipeForm.newRecipe')}
      </Heading>
      <Text className="mt-4 text-ice/70">{t('screens.comingSoon')}</Text>
    </Box>
  );
}
