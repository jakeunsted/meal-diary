import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useRecipe } from '@/lib/queries/recipes';

export default function EditRecipeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = id ? Number.parseInt(id, 10) : undefined;
  const parsedRecipeId = Number.isFinite(recipeId) ? recipeId : undefined;
  const recipeQuery = useRecipe(parsedRecipeId);

  if (!parsedRecipeId) {
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

      {recipeQuery.isLoading ? (
        <Box className="items-center py-8">
          <ActivityIndicator size="large" color="#6366F1" />
        </Box>
      ) : (
        <>
          <Heading className="text-ice" size="lg">
            {t('recipeForm.editRecipe')}
          </Heading>
          {recipeQuery.data ? (
            <Text className="mt-2 text-ice/70">{recipeQuery.data.name}</Text>
          ) : null}
          <Text className="mt-4 text-ice/70">{t('screens.comingSoon')}</Text>
        </>
      )}
    </Box>
  );
}
