import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddRecipeToShoppingListModal } from '@/components/recipe/AddRecipeToShoppingListModal';
import { DeleteRecipeModal } from '@/components/recipe/DeleteRecipeModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';
import { isNetworkError } from '@/lib/auth/httpError';
import { getEntitlementFeatureFromError } from '@/lib/entitlements/entitlementErrors';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { useRecipeEntitlements } from '@/lib/entitlements/useRecipeEntitlements';
import { buildShoppingListItemsFromRecipe, formatIngredientDisplayLine } from '@/lib/recipe/buildShoppingListItemsFromRecipe';
import { useCurrentUser, useEntitlements } from '@/lib/queries/profile';
import { useDeleteRecipe, useRecipe } from '@/lib/queries/recipes';
import { useBulkAddShoppingListItems } from '@/lib/queries/shoppingList';
import { isShoppingListOfflineQueuedError } from '@/lib/shopping-list/shoppingListOfflineError';
import type { RecipeIngredient } from '@/types/recipe';

function getIngredientKey(ingredient: RecipeIngredient, index: number): string {
  return ingredient.id != null ? String(ingredient.id) : `index-${index}`;
}

function filterIngredientsBySelectedKeys(
  ingredients: RecipeIngredient[],
  selectedKeys: string[]
): RecipeIngredient[] {
  const selectedKeySet = new Set(selectedKeys);
  return ingredients.filter((ingredient, index) =>
    selectedKeySet.has(getIngredientKey(ingredient, index))
  );
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
  const entitlementsQuery = useEntitlements(familyGroupId);
  const recipeEntitlements = useRecipeEntitlements(entitlementsQuery.data);
  const recipeQuery = useRecipe(parsedRecipeId);
  const deleteRecipeMutation = useDeleteRecipe();
  const bulkAddShoppingListItemsMutation = useBulkAddShoppingListItems();
  const openPaywall = usePaywallStore((state) => state.openPaywall);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isAddToShoppingListModalVisible, setIsAddToShoppingListModalVisible] = useState(false);
  const [addToShoppingListMessage, setAddToShoppingListMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const recipe = recipeQuery.data;
  const isLoading = recipeQuery.isLoading && !recipe;
  const isRefreshing = recipeQuery.isFetching && !!recipe;

  const handleEdit = () => {
    if (!parsedRecipeId) {
      return;
    }
    router.push(`/(tabs)/recipes/${parsedRecipeId}/edit` as Href);
  };

  const handleOpenPlans = () => {
    void Linking.openURL(`${env.webUrl}/plans`);
  };

  const handleOpenAddToShoppingListModal = () => {
    if (!recipe?.ingredients?.length || !familyGroupId) {
      return;
    }

    if (!recipeEntitlements.canAddToShoppingList) {
      openPaywall('recipe_to_shopping_list');
      return;
    }

    setAddToShoppingListMessage(null);
    setIsAddToShoppingListModalVisible(true);
  };

  const handleConfirmAddToShoppingList = async (selectedKeys: string[]) => {
    if (!recipe?.ingredients?.length || !familyGroupId) {
      return;
    }

    const selectedIngredients = filterIngredientsBySelectedKeys(recipe.ingredients, selectedKeys);
    if (!selectedIngredients.length) {
      return;
    }

    setAddToShoppingListMessage(null);

    try {
      const items = buildShoppingListItemsFromRecipe(selectedIngredients);
      await bulkAddShoppingListItemsMutation.mutateAsync({ familyGroupId, items });
      setIsAddToShoppingListModalVisible(false);
      setAddToShoppingListMessage(t('recipeDetail.addedToShoppingList'));
    } catch (error) {
      if (isShoppingListOfflineQueuedError(error) || isNetworkError(error)) {
        setIsAddToShoppingListModalVisible(false);
        setAddToShoppingListMessage(t('recipeDetail.addedToShoppingList'));
        return;
      }

      const entitlementFeature = getEntitlementFeatureFromError(error);
      if (entitlementFeature) {
        openPaywall(entitlementFeature);
        return;
      }

      setAddToShoppingListMessage(t('recipeDetail.addToShoppingListFailed'));
    }
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
      setDeleteError(t('recipeForm.deleteFailed'));
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
            onRefresh={() => {
              void recipeQuery.refetch();
              void entitlementsQuery.refetch();
            }}
            tintColor="#6366F1"
          />
        }
      >
        <View className="mb-4 flex-row items-center justify-between gap-2">
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-2 py-2"
            onPress={() => router.back()}
          >
            <FontAwesome name="chevron-left" size={14} color="#F1F5F9" />
            <Text className="text-ice">{t('common.back')}</Text>
          </Pressable>

          {recipe ? (
            <View className="flex-row gap-2">
              <Button
                size="sm"
                variant="outline"
                onPress={handleEdit}
                testID="recipe-edit-button"
                accessibilityLabel={t('recipeForm.editRecipe')}
              >
                <FontAwesome name="pencil" size={12} color="#F1F5F9" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-400"
                onPress={() => setIsDeleteModalVisible(true)}
                testID="recipe-delete-button"
                accessibilityLabel={t('recipeForm.deleteRecipe')}
              >
                <FontAwesome name="trash" size={12} color="#F87171" />
              </Button>
            </View>
          ) : null}
        </View>

        {isLoading ? (
          <Box className="items-center py-8">
            <ActivityIndicator size="large" color="#6366F1" />
          </Box>
        ) : !recipe ? (
          <Box className="items-center py-8">
            <Text className="text-ice/70">
              {recipeQuery.isError ? t('recipeDetail.loadFailed') : t('recipeDetail.notFound')}
            </Text>
            {recipeQuery.isError ? (
              <Button className="mt-4 bg-primary" onPress={() => void recipeQuery.refetch()}>
                <ButtonText>{t('diary.retry')}</ButtonText>
              </Button>
            ) : null}
          </Box>
        ) : (
          <>
            {deleteError ? (
              <Box className="mb-4 rounded-lg bg-red-500/15 px-4 py-3" testID="recipe-delete-error">
                <Text className="text-sm text-red-400">{deleteError}</Text>
              </Box>
            ) : null}
            <Heading className="mb-4 text-2xl text-ice" size="xl">
              {recipe.name}
            </Heading>

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
                          {formatIngredientDisplayLine(ingredient)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Box>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full border-primary"
                  onPress={handleOpenAddToShoppingListModal}
                  disabled={bulkAddShoppingListItemsMutation.isPending}
                  testID="recipe-add-to-shopping-list-button"
                >
                  {bulkAddShoppingListItemsMutation.isPending ? (
                    <ActivityIndicator size="small" color="#6366F1" />
                  ) : (
                    <FontAwesome name="list" size={12} color="#6366F1" />
                  )}
                  <ButtonText className="ml-2 text-primary">
                    {t('recipeDetail.addToShoppingList')}
                  </ButtonText>
                </Button>
                {!recipeEntitlements.canAddToShoppingList ? (
                  <Text
                    className="mt-2 text-sm text-ice/60"
                    testID="recipe-shopping-list-premium-hint"
                  >
                    {t('recipeDetail.shoppingListPremium')}
                    {recipeEntitlements.billing?.isOwner ? (
                      <Text className="text-primary" onPress={handleOpenPlans}>
                        {' '}
                        {t('recipeDetail.shoppingListUpgrade')}
                      </Text>
                    ) : null}
                  </Text>
                ) : null}
                {addToShoppingListMessage ? (
                  <Text
                    className={`mt-2 text-sm ${
                      addToShoppingListMessage === t('recipeDetail.addedToShoppingList')
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {addToShoppingListMessage}
                  </Text>
                ) : null}
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

      <AddRecipeToShoppingListModal
        visible={isAddToShoppingListModalVisible}
        ingredients={recipe?.ingredients ?? []}
        isSubmitting={bulkAddShoppingListItemsMutation.isPending}
        onClose={() => setIsAddToShoppingListModalVisible(false)}
        onConfirm={(selectedKeys) => void handleConfirmAddToShoppingList(selectedKeys)}
      />

      <DeleteRecipeModal
        visible={isDeleteModalVisible}
        isDeleting={deleteRecipeMutation.isPending}
        onClose={() => setIsDeleteModalVisible(false)}
        onConfirm={() => void handleDelete()}
      />
    </Box>
  );
}
