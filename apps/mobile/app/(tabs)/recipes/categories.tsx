import FontAwesome from '@expo/vector-icons/FontAwesome';
import { normalizeRecipeCategoryName, recipeCategoryNameError } from '@meal-diary/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api/client';
import { getEntitlementFeatureFromError } from '@/lib/entitlements/entitlementErrors';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { useCurrentUser, useEntitlements } from '@/lib/queries/profile';
import {
  useCreateRecipeCategory,
  useDeleteRecipeCategory,
  useRecipeCategories,
  useRenameRecipeCategory,
} from '@/lib/queries/recipeCategories';
import { recipeCategoryNameErrorKey } from '@/lib/recipe/recipeCategoryNameError';
import type { RecipeCategory } from '@/types/recipe';

const inputClassName =
  'rounded-lg border border-white/10 bg-surface px-4 py-3 text-base text-ice';

export default function RecipeCategoriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const entitlementsQuery = useEntitlements(familyGroupId);
  const categoriesQuery = useRecipeCategories(familyGroupId);
  const createCategoryMutation = useCreateRecipeCategory(familyGroupId);
  const renameCategoryMutation = useRenameRecipeCategory(familyGroupId);
  const deleteCategoryMutation = useDeleteRecipeCategory(familyGroupId);
  const openPaywall = usePaywallStore((state) => state.openPaywall);
  const [nameDraft, setNameDraft] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<RecipeCategory | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const categories = categoriesQuery.data ?? [];
  const featureKnownOn = entitlementsQuery.data?.features.custom_recipe_categories === true;
  const featureKnownOff =
    entitlementsQuery.isSuccess && entitlementsQuery.data.features.custom_recipe_categories !== true;
  const starters = categories.filter((category) => category.is_default);
  const customCategories = featureKnownOn
    ? categories.filter((category) => !category.is_default)
    : [];
  const isSaving =
    createCategoryMutation.isPending ||
    renameCategoryMutation.isPending ||
    deleteCategoryMutation.isPending;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([categoriesQuery.refetch(), entitlementsQuery.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!familyGroupId) {
        return;
      }

      void categoriesQuery.refetch();
      void entitlementsQuery.refetch();
    }, [familyGroupId, categoriesQuery.refetch, entitlementsQuery.refetch])
  );

  const handleCategoryError = (error: unknown, setFieldError: (message: string) => void) => {
    const entitlementFeature = getEntitlementFeatureFromError(error);
    if (entitlementFeature) {
      openPaywall(entitlementFeature);
      return;
    }

    if (error instanceof ApiError) {
      const errorKey = recipeCategoryNameErrorKey(error.code);
      if (errorKey) {
        setFieldError(t(errorKey));
        return;
      }

      if (error.code === 'default_category_locked') {
        setActionError(t('recipes.categories.startersFixed'));
        return;
      }
    }

    setActionError(t('login.networkError'));
  };

  const handleAddCategory = async () => {
    if (!familyGroupId || isSaving || entitlementsQuery.isLoading) {
      return;
    }

    if (!featureKnownOn) {
      openPaywall('custom_recipe_categories');
      return;
    }

    const nameError = recipeCategoryNameError(
      nameDraft,
      categories.map((category) => category.name)
    );
    if (nameError) {
      setAddError(t(recipeCategoryNameErrorKey(nameError) ?? 'recipes.categories.nameInvalid'));
      return;
    }

    setAddError(null);
    setActionError(null);

    try {
      await createCategoryMutation.mutateAsync(normalizeRecipeCategoryName(nameDraft));
      setNameDraft('');
    } catch (error) {
      handleCategoryError(error, setAddError);
    }
  };

  const handleStartRename = (category: RecipeCategory) => {
    if (!featureKnownOn || isSaving) {
      return;
    }

    setRenamingId(category.id);
    setRenameDraft(category.name);
    setRenameError(null);
    setActionError(null);
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
    setRenameError(null);
  };

  const handleSaveRename = async () => {
    if (!familyGroupId || renamingId == null || isSaving) {
      return;
    }

    if (!featureKnownOn) {
      openPaywall('custom_recipe_categories');
      return;
    }

    const nameError = recipeCategoryNameError(
      renameDraft,
      categories
        .filter((category) => category.id !== renamingId)
        .map((category) => category.name)
    );
    if (nameError) {
      setRenameError(t(recipeCategoryNameErrorKey(nameError) ?? 'recipes.categories.nameInvalid'));
      return;
    }

    setRenameError(null);
    setActionError(null);

    try {
      await renameCategoryMutation.mutateAsync({
        categoryId: renamingId,
        name: normalizeRecipeCategoryName(renameDraft),
      });
      setRenamingId(null);
      setRenameDraft('');
    } catch (error) {
      handleCategoryError(error, setRenameError);
    }
  };

  const handleOpenDelete = (category: RecipeCategory) => {
    if (!featureKnownOn || isSaving) {
      return;
    }

    setDeleteError(null);
    setCategoryToDelete(category);
  };

  const handleCloseDelete = () => {
    if (deleteCategoryMutation.isPending) {
      return;
    }

    setCategoryToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!familyGroupId || !categoryToDelete || deleteCategoryMutation.isPending) {
      return;
    }

    if (!featureKnownOn) {
      setCategoryToDelete(null);
      openPaywall('custom_recipe_categories');
      return;
    }

    setDeleteError(null);
    setActionError(null);

    try {
      await deleteCategoryMutation.mutateAsync(categoryToDelete.id);
      if (renamingId === categoryToDelete.id) {
        setRenamingId(null);
        setRenameDraft('');
      }
      setCategoryToDelete(null);
    } catch (error) {
      const entitlementFeature = getEntitlementFeatureFromError(error);
      if (entitlementFeature) {
        setCategoryToDelete(null);
        openPaywall(entitlementFeature);
        return;
      }

      setDeleteError(t('login.networkError'));
    }
  };

  return (
    <Box className="flex-1 bg-base" testID="recipe-categories-screen">
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: 16,
          paddingBottom: 32,
        }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        mode="layout"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            tintColor="#6366F1"
          />
        }
        style={{ flex: 1 }}
      >
        <Pressable
          accessibilityRole="button"
          className="mb-4 flex-row items-center gap-2 py-2"
          onPress={() => router.back()}
        >
          <FontAwesome name="chevron-left" size={14} color="#F1F5F9" />
          <Text className="text-ice">{t('common.back')}</Text>
        </Pressable>

        <ScreenTitle align="left">{t('recipes.categories.manage')}</ScreenTitle>
        <Text className="mb-4 text-sm text-ice/70">{t('recipes.categories.sharedNotice')}</Text>

        {featureKnownOff ? (
          <Box
            className="mb-4 rounded-lg border border-warning/40 bg-warning/15 px-4 py-3"
            testID="recipe-categories-lapsed-note"
          >
            <Text className="text-sm text-ice">{t('recipes.categories.lapsedNote')}</Text>
          </Box>
        ) : null}

        {categoriesQuery.isLoading && categories.length === 0 ? (
          <Box className="items-center py-8">
            <ActivityIndicator size="large" color="#6366F1" />
          </Box>
        ) : categoriesQuery.isError && categories.length === 0 ? (
          <Box className="mb-4 rounded-lg bg-red-500/15 px-4 py-3">
            <Text className="text-sm text-red-400">{t('login.networkError')}</Text>
            <Button className="mt-3 self-start bg-primary" onPress={() => void handleRefresh()}>
              <ButtonText>{t('diary.retry')}</ButtonText>
            </Button>
          </Box>
        ) : (
          <View className="gap-3">
            <Text className="text-sm text-ice/70">{t('recipes.categories.startersFixed')}</Text>
            {starters.map((category) => (
              <View
                key={category.id}
                className="rounded-xl border border-white/10 bg-surface px-4 py-3"
                testID={`recipe-category-starter-${category.id}`}
              >
                <Text className="text-base text-ice">{category.name}</Text>
              </View>
            ))}

            {customCategories.map((category) => {
              const isRenaming = renamingId === category.id;

              return (
                <View
                  key={category.id}
                  className="rounded-xl border border-white/10 bg-surface px-4 py-3"
                  testID={`recipe-category-custom-${category.id}`}
                >
                  {isRenaming ? (
                    <View className="gap-3">
                      <Text className="text-sm font-semibold text-ice">
                        {t('recipes.categories.nameLabel')}
                      </Text>
                      <TextInput
                        className={inputClassName}
                        value={renameDraft}
                        onChangeText={setRenameDraft}
                        placeholder={t('recipes.categories.nameLabel')}
                        placeholderTextColor="rgba(241, 245, 249, 0.4)"
                        editable={!isSaving}
                        testID={`recipe-category-rename-input-${category.id}`}
                      />
                      <Text className="text-sm text-ice/70">
                        {t('recipes.categories.renameNotice')}
                      </Text>
                      {renameError ? (
                        <Text className="text-sm text-red-400" testID="recipe-category-name-error">
                          {renameError}
                        </Text>
                      ) : null}
                      <View className="flex-row justify-end gap-2">
                        <Button variant="ghost" onPress={handleCancelRename} disabled={isSaving}>
                          <ButtonText>{t('common.cancel')}</ButtonText>
                        </Button>
                        <Button
                          className="bg-primary"
                          onPress={() => void handleSaveRename()}
                          disabled={isSaving}
                          testID={`recipe-category-rename-save-${category.id}`}
                        >
                          {renameCategoryMutation.isPending ? (
                            <ButtonSpinner color="#F1F5F9" />
                          ) : null}
                          <ButtonText className="text-ice">{t('recipes.categories.rename')}</ButtonText>
                        </Button>
                      </View>
                    </View>
                  ) : (
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="min-w-0 flex-1 text-base text-ice">{category.name}</Text>
                      <View className="flex-row gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => handleStartRename(category)}
                          disabled={isSaving}
                          testID={`recipe-category-rename-${category.id}`}
                        >
                          <ButtonText>{t('recipes.categories.rename')}</ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-400"
                          onPress={() => handleOpenDelete(category)}
                          disabled={isSaving}
                          testID={`recipe-category-delete-${category.id}`}
                        >
                          <ButtonText className="text-red-400">
                            {t('recipes.categories.delete')}
                          </ButtonText>
                        </Button>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            <Box className="mt-2 gap-3">
              {featureKnownOn ? (
                <>
                  <Text className="text-sm font-semibold text-ice">
                    {t('recipes.categories.nameLabel')}
                  </Text>
                  <TextInput
                    className={inputClassName}
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    placeholder={t('recipes.categories.nameLabel')}
                    placeholderTextColor="rgba(241, 245, 249, 0.4)"
                    editable={!isSaving}
                    testID="recipe-category-add-input"
                  />
                  {addError ? (
                    <Text className="text-sm text-red-400" testID="recipe-category-name-error">
                      {addError}
                    </Text>
                  ) : null}
                </>
              ) : null}
              <Button
                className="self-start bg-primary"
                onPress={() => void handleAddCategory()}
                disabled={isSaving || entitlementsQuery.isLoading}
                testID="recipe-category-add-button"
              >
                {createCategoryMutation.isPending ? <ButtonSpinner color="#F1F5F9" /> : null}
                <ButtonText className="text-ice">{t('recipes.categories.add')}</ButtonText>
              </Button>
            </Box>

            {actionError ? (
              <Text className="text-sm text-red-400" testID="recipe-category-action-error">
                {actionError}
              </Text>
            ) : null}
          </View>
        )}
      </KeyboardAwareScrollView>

      <DialogModal visible={categoryToDelete != null} onClose={handleCloseDelete}>
        <DialogPanel>
          <Heading size="lg" className="mb-3 text-red-400">
            {t('recipes.categories.deleteTitle', { name: categoryToDelete?.name ?? '' })}
          </Heading>
          <Text className="mb-6 text-ice/80">
            {t('recipes.categories.deleteBody', { name: categoryToDelete?.name ?? '' })}
          </Text>
          {deleteError ? (
            <Text className="mb-4 text-sm text-red-400">{deleteError}</Text>
          ) : null}
          <Box className="flex-row justify-end gap-3">
            <Button
              variant="outline"
              onPress={handleCloseDelete}
              disabled={deleteCategoryMutation.isPending}
            >
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button
              className="bg-red-500"
              onPress={() => void handleConfirmDelete()}
              disabled={deleteCategoryMutation.isPending}
              testID="recipe-category-delete-confirm"
            >
              {deleteCategoryMutation.isPending ? <ButtonSpinner color="#F1F5F9" /> : null}
              <ButtonText className="text-ice">{t('recipes.categories.delete')}</ButtonText>
            </Button>
          </Box>
        </DialogPanel>
      </DialogModal>
    </Box>
  );
}
