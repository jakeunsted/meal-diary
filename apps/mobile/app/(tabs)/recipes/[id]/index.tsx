import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeleteRecipeModal } from '@/components/recipe/DeleteRecipeModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/lib/queries/profile';
import { useDeleteRecipe, useRecipe } from '@/lib/queries/recipes';
import type { RecipeIngredient } from '@/types/recipe';

function formatIngredientLine(ingredient: RecipeIngredient): string {
  if (ingredient.quantity && ingredient.unit) {
    return `${ingredient.name} — ${ingredient.quantity} ${ingredient.unit}`;
  }
  if (ingredient.quantity) {
    return `${ingredient.name} — ${ingredient.quantity}`;
  }
  return ingredient.name;
}

export default function RecipeDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = id ? Number.parseInt(id, 10) : undefined;
  const parsedRecipeId = Number.isFinite(recipeId) ? recipeId : undefined;
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const recipeQuery = useRecipe(parsedRecipeId);
  const deleteRecipeMutation = useDeleteRecipe();
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const recipe = recipeQuery.data;
  const isLoading = recipeQuery.isLoading && !recipe;
  const isRefreshing = recipeQuery.isFetching && !!recipe;

  const handleEdit = () => {
    if (!parsedRecipeId) {
      return;
    }
    router.push(`/(tabs)/recipes/${parsedRecipeId}/edit` as Href);
  };

  const handleDelete = async () => {
    if (!parsedRecipeId || !familyGroupId) {
      return;
    }

    try {
      await deleteRecipeMutation.mutateAsync({
        recipeId: parsedRecipeId,
        familyGroupId,
      });
      setIsDeleteModalVisible(false);
      router.replace('/(tabs)/recipes' as Href);
    } catch {
      setIsDeleteModalVisible(false);
    }
  };

  return (
    <Box className="flex-1 bg-base" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void recipeQuery.refetch()}
            tintColor="#6366F1"
          />
        }
      >
        <Pressable
          accessibilityRole="button"
          className="mb-4 flex-row items-center gap-2 py-2"
          onPress={() => router.back()}
        >
          <FontAwesome name="chevron-left" size={14} color="#F1F5F9" />
          <Text className="text-ice">{t('common.back')}</Text>
        </Pressable>

        {isLoading ? (
          <Box className="items-center py-8">
            <ActivityIndicator size="large" color="#6366F1" />
          </Box>
        ) : !recipe ? (
          <Box className="items-center py-8">
            <Text className="text-ice/70">{t('recipeDetail.notFound')}</Text>
            {recipeQuery.isError ? (
              <Button className="mt-4 bg-primary" onPress={() => void recipeQuery.refetch()}>
                <ButtonText>{t('diary.retry')}</ButtonText>
              </Button>
            ) : null}
          </Box>
        ) : (
          <>
            <View className="mb-4 flex-row items-start justify-between gap-3">
              <Heading className="min-w-0 flex-1 text-2xl text-ice" size="xl">
                {recipe.name}
              </Heading>
              <View className="flex-row gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onPress={handleEdit}
                  testID="recipe-edit-button"
                >
                  <FontAwesome name="pencil" size={12} color="#F1F5F9" />
                  <ButtonText className="ml-2 text-ice">{t('recipeForm.editRecipe')}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-400"
                  onPress={() => setIsDeleteModalVisible(true)}
                  testID="recipe-delete-button"
                >
                  <FontAwesome name="trash" size={12} color="#F87171" />
                </Button>
              </View>
            </View>

            {recipe.description ? (
              <Text className="mb-4 text-ice/70">{recipe.description}</Text>
            ) : null}

            {recipe.portions ? (
              <View className="mb-4 self-start rounded-full bg-primary px-3 py-1">
                <Text className="text-sm text-ice">
                  {recipe.portions} {t('recipeForm.portionsLabel')}
                </Text>
              </View>
            ) : null}

            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              <Box className="mb-6">
                <Heading className="mb-3 text-lg text-ice" size="md">
                  {t('recipeForm.ingredients')}
                </Heading>
                <Box className="rounded-xl border border-white/10 bg-surface p-4">
                  <View className="gap-3">
                    {recipe.ingredients.map((ingredient, index) => (
                      <View
                        key={ingredient.id ?? `${ingredient.name}-${index}`}
                        className="flex-row items-start gap-2"
                      >
                        <View className="mt-2 h-2 w-2 rounded-full bg-primary" />
                        <Text className="flex-1 text-ice">
                          {formatIngredientLine(ingredient)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Box>
              </Box>
            ) : null}

            {recipe.instructions ? (
              <Box className="mb-6">
                <Heading className="mb-3 text-lg text-ice" size="md">
                  {t('recipeForm.instructions')}
                </Heading>
                <Box className="rounded-xl border border-white/10 bg-surface p-4">
                  <Text className="text-ice leading-6">{recipe.instructions}</Text>
                </Box>
              </Box>
            ) : null}
          </>
        )}
      </ScrollView>

      <DeleteRecipeModal
        visible={isDeleteModalVisible}
        isDeleting={deleteRecipeMutation.isPending}
        onClose={() => setIsDeleteModalVisible(false)}
        onConfirm={() => void handleDelete()}
      />
    </Box>
  );
}
