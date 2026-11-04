import FontAwesome from '@expo/vector-icons/FontAwesome';
import { toRecipeSyncValue, type RecipeSyncValue } from '@meal-diary/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeForm, type RecipeFormValues } from '@/components/recipe/RecipeForm';
import { RecipeSyncStatusBanner } from '@/components/recipe/RecipeSyncReview';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { Text } from '@/components/ui/text';
import { captureEvent } from '@/lib/analytics/posthog';
import { getEntitlementFeatureFromError } from '@/lib/entitlements/entitlementErrors';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { useCurrentUser } from '@/lib/queries/profile';
import { useRecipe } from '@/lib/queries/recipes';
import { saveRecipeEdit } from '@/lib/recipe/recipeSync';
import type { UpdateRecipePayload } from '@/types/recipe';

export default function EditRecipeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = id ? Number.parseInt(id, 10) : undefined;
  const parsedRecipeId = Number.isFinite(recipeId) ? recipeId : undefined;
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const recipeQuery = useRecipe(parsedRecipeId);
  const queryClient = useQueryClient();
  const openPaywall = usePaywallStore((state) => state.openPaywall);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [baseline, setBaseline] = useState<RecipeSyncValue | null>(null);

  useEffect(() => {
    if (!recipeQuery.data || formDirty) {
      return;
    }
    setBaseline(toRecipeSyncValue(recipeQuery.data));
  }, [formDirty, recipeQuery.data]);

  if (!parsedRecipeId) {
    return <Redirect href="/(tabs)/recipes" />;
  }

  const handleUpdate = async (formData: RecipeFormValues) => {
    if (!familyGroupId || !parsedRecipeId) {
      return;
    }

    setSubmitError(null);

    setIsSaving(true);
    try {
      await saveRecipeEdit(queryClient, {
        recipeId: parsedRecipeId,
        familyGroupId,
        payload: formData as UpdateRecipePayload,
        baseline,
        current: recipeQuery.data ?? null,
      });
      captureEvent('recipe_edited');
      router.back();
    } catch (error) {
      const entitlementFeature = getEntitlementFeatureFromError(error);
      if (entitlementFeature) {
        openPaywall(entitlementFeature);
        return;
      }

      setSubmitError(t('recipeForm.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <Box className="flex-1 bg-base">
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
        style={{ flex: 1 }}
      >
          <Pressable
            accessibilityRole="button"
            className="mb-4 flex-row items-center gap-2 py-2"
            onPress={handleCancel}
          >
            <FontAwesome name="chevron-left" size={14} color="#F1F5F9" />
            <Text className="text-ice">{t('common.back')}</Text>
          </Pressable>

          <ScreenTitle align="left">{t('recipeForm.editRecipe')}</ScreenTitle>
          <RecipeSyncStatusBanner />

          {recipeQuery.isFetching && recipeQuery.data ? (
            <Box className="mb-2 items-end" accessibilityLabel={t('recipeSync.refreshing')}>
              <ActivityIndicator size="small" color="#6366F1" testID="recipe-refreshing" />
            </Box>
          ) : null}

          {recipeQuery.isLoading && !recipeQuery.data ? (
            <Box className="items-center py-8">
              <ActivityIndicator size="large" color="#6366F1" />
            </Box>
          ) : !recipeQuery.data ? (
            <Box className="items-center py-8">
              <Text className="text-ice/70">{t('recipeDetail.notFound')}</Text>
              <Button className="mt-4 bg-primary" onPress={() => void recipeQuery.refetch()}>
                <ButtonText>{t('diary.retry')}</ButtonText>
              </Button>
            </Box>
          ) : (
            <>
              {submitError ? (
                <Box className="mb-4 rounded-lg bg-red-500/15 px-4 py-3">
                  <Text className="text-sm text-red-400">{submitError}</Text>
                </Box>
              ) : null}
              <RecipeForm
                initialData={recipeQuery.data}
                submitLabel={t('recipeForm.saveChanges')}
                isLoading={isSaving}
                onDirty={() => setFormDirty(true)}
                onSubmit={handleUpdate}
                onCancel={handleCancel}
              />
            </>
          )}
      </KeyboardAwareScrollView>
    </Box>
  );
}
