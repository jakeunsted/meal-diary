import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { Recipe } from '@/types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: () => void;
}

export function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  const { t } = useTranslation();
  const ingredientCount = recipe.ingredients?.length ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      className="rounded-xl border border-white/10 bg-surface px-4 py-4 active:bg-white/5"
      onPress={onPress}
      testID={`recipe-card-${recipe.id}`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-base font-semibold text-ice">{recipe.name}</Text>
          {recipe.description ? (
            <Text className="mt-1 text-sm text-ice/60" numberOfLines={2}>
              {recipe.description}
            </Text>
          ) : null}
        </View>

        <View className="flex-row flex-wrap items-center justify-end gap-2">
          {recipe.portions ? (
            <View className="rounded-full border border-white/10 bg-base px-2 py-1">
              <Text className="text-xs text-ice/70">
                {recipe.portions} {t('recipeForm.portionsLabel')}
              </Text>
            </View>
          ) : null}
          {ingredientCount > 0 ? (
            <View className="rounded-full border border-white/10 bg-base px-2 py-1">
              <Text className="text-xs text-ice/70">
                {ingredientCount}{' '}
                {ingredientCount === 1
                  ? t('recipeForm.ingredient')
                  : t('recipeForm.ingredientsCount')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
