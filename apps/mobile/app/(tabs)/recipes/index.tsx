import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { useRecipeEntitlements } from '@/lib/entitlements/useRecipeEntitlements';
import { useCurrentUser, useEntitlements } from '@/lib/queries/profile';
import { useFamilyRecipes } from '@/lib/queries/recipes';

export default function RecipesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const entitlementsQuery = useEntitlements(familyGroupId);
  const recipesQuery = useFamilyRecipes(familyGroupId);
  const openPaywall = usePaywallStore((state) => state.openPaywall);
  const recipeEntitlements = useRecipeEntitlements(entitlementsQuery.data);
  const [searchQuery, setSearchQuery] = useState('');

  const allRecipes = recipesQuery.data ?? [];
  const filteredRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return allRecipes;
    }

    return allRecipes.filter((recipe) => recipe.name.toLowerCase().includes(query));
  }, [allRecipes, searchQuery]);

  const hasRecipeData = allRecipes.length > 0;
  const showSkeleton = recipesQuery.isLoading && !hasRecipeData;
  const showListLoading = recipesQuery.isFetching && hasRecipeData;

  const handleOpenPlans = () => {
    void Linking.openURL(`${env.webUrl}/plans`);
  };

  const handleCreateRecipe = () => {
    if (!recipeEntitlements.canCreateRecipe) {
      openPaywall('recipes');
      return;
    }

    router.push('/(tabs)/recipes/create' as Href);
  };

  const handleRecipePress = (recipeId: number) => {
    router.push(`/(tabs)/recipes/${recipeId}` as Href);
  };

  const handleRefresh = () => {
    void recipesQuery.refetch();
    void entitlementsQuery.refetch();
  };

  useFocusEffect(
    useCallback(() => {
      if (!familyGroupId) {
        return;
      }

      void entitlementsQuery.refetch();
      void recipesQuery.refetch();
    }, [familyGroupId, entitlementsQuery.refetch, recipesQuery.refetch])
  );

  return (
    <Box className="flex-1 bg-base" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={showListLoading}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
      >
        <Heading className="my-4 text-center text-2xl text-ice" size="xl">
          {t('recipeForm.title')}
        </Heading>

        {recipeEntitlements.recipeUsageLabel ? (
          <Text
            className="mb-2 text-center text-sm text-ice/70"
            testID="recipes-usage-label"
          >
            {recipeEntitlements.recipeUsageLabel}
          </Text>
        ) : null}

        {recipesQuery.isError && !hasRecipeData ? (
          <Box className="mb-4 rounded-lg bg-red-500/15 px-4 py-3" testID="recipes-load-error">
            <Text className="text-sm text-red-400">{t('recipesPage.loadFailed')}</Text>
            <Button className="mt-3 self-start bg-primary" onPress={handleRefresh}>
              <ButtonText>{t('diary.retry')}</ButtonText>
            </Button>
          </Box>
        ) : null}

        {!recipeEntitlements.canCreateRecipe ? (
          <Box
            className="mb-4 rounded-lg border border-warning/40 bg-warning/15 px-4 py-3"
            testID="recipes-limit-alert"
          >
            <Text className="text-sm text-ice">{t('recipesPage.limitReached')}</Text>
            <Text className="mt-2 text-sm text-ice/80">
              {recipeEntitlements.recipeLimitHelperText}
            </Text>
            {recipeEntitlements.billing?.isOwner ? (
              <Pressable
                accessibilityRole="link"
                className="mt-3 self-start rounded-lg bg-primary px-3 py-2"
                onPress={handleOpenPlans}
              >
                <Text className="text-sm font-medium text-ice">
                  {t('recipesPage.upgradeLink')}
                </Text>
              </Pressable>
            ) : null}
          </Box>
        ) : null}

        <View className="mb-4 flex-row items-center gap-2">
          <View className="relative min-w-0 flex-1">
            <FontAwesome
              name="search"
              size={14}
              color="rgba(241, 245, 249, 0.5)"
              style={{ position: 'absolute', left: 12, top: 14, zIndex: 1 }}
            />
            <TextInput
              className="rounded-lg border border-white/10 bg-surface px-10 py-3 text-base text-ice"
              placeholder={t('recipeForm.searchPlaceholder')}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              testID="recipes-search-input"
            />
          </View>
          <Button
            size="sm"
            className={recipeEntitlements.canCreateRecipe ? 'bg-primary' : 'bg-primary/40'}
            disabled={!recipeEntitlements.canCreateRecipe}
            onPress={handleCreateRecipe}
            testID="recipes-new-button"
          >
            <ButtonText className="text-ice">{t('recipeForm.newRecipe')}</ButtonText>
          </Button>
        </View>

        {showSkeleton ? (
          <Box className="items-center py-8">
            <ActivityIndicator size="large" color="#6366F1" />
          </Box>
        ) : allRecipes.length === 0 ? (
          <Box className="items-center py-12">
            <FontAwesome name="book" size={48} color="rgba(241, 245, 249, 0.3)" />
            <Text className="mt-4 text-lg font-medium text-ice">
              {t('recipeForm.emptyTitle')}
            </Text>
            <Text className="mt-2 text-center text-ice/60">
              {t('recipeForm.emptyDescription')}
            </Text>
            <Button
              className={`mt-4 ${recipeEntitlements.canCreateRecipe ? 'bg-primary' : 'bg-primary/40'}`}
              disabled={!recipeEntitlements.canCreateRecipe}
              onPress={handleCreateRecipe}
            >
              <FontAwesome name="plus" size={14} color="#F1F5F9" />
              <ButtonText className="ml-2 text-ice">{t('recipeForm.newRecipe')}</ButtonText>
            </Button>
          </Box>
        ) : filteredRecipes.length === 0 ? (
          <Box className="items-center py-12">
            <Text className="text-lg font-medium text-ice">
              {t('recipeForm.noResultsTitle')}
            </Text>
            <Text className="mt-2 text-ice/60">{t('recipeForm.noResultsDescription')}</Text>
          </Box>
        ) : (
          <View className="gap-3">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={() => handleRecipePress(recipe.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Box>
  );
}
