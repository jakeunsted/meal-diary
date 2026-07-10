import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { useRecipe } from '@/lib/queries/recipes';

export default function RecipeDetailPlaceholderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = id ? Number.parseInt(id, 10) : undefined;
  const recipeQuery = useRecipe(Number.isFinite(recipeId) ? recipeId : undefined);

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

      {recipeQuery.isLoading ? (
        <Box className="items-center py-8">
          <ActivityIndicator size="large" color="#6366F1" />
        </Box>
      ) : recipeQuery.data ? (
        <Text className="text-xl font-semibold text-ice">{recipeQuery.data.name}</Text>
      ) : (
        <Text className="text-ice/70">{t('recipeDetail.notFound')}</Text>
      )}
    </Box>
  );
}
