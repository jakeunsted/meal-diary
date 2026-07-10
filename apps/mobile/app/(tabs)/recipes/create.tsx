import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeForm, type RecipeFormValues } from '@/components/recipe/RecipeForm';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';
import { getEntitlementFeatureFromError } from '@/lib/entitlements/entitlementErrors';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { useRecipeEntitlements } from '@/lib/entitlements/useRecipeEntitlements';
import { useCurrentUser, useEntitlements } from '@/lib/queries/profile';
import { useCreateRecipe } from '@/lib/queries/recipes';
import type { CreateRecipePayload } from '@/types/recipe';

export default function CreateRecipeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const entitlementsQuery = useEntitlements(familyGroupId);
  const recipeEntitlements = useRecipeEntitlements(entitlementsQuery.data);
  const createRecipeMutation = useCreateRecipe();
  const openPaywall = usePaywallStore((state) => state.openPaywall);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleOpenPlans = () => {
    void Linking.openURL(`${env.webUrl}/plans`);
  };

  const handleCreate = async (formData: RecipeFormValues) => {
    if (!familyGroupId) {
      return;
    }

    if (!recipeEntitlements.canCreateRecipe) {
      openPaywall('recipes');
      return;
    }

    setSubmitError(null);

    try {
      const recipe = await createRecipeMutation.mutateAsync({
        familyGroupId,
        payload: formData as CreateRecipePayload,
      });
      void entitlementsQuery.refetch();
      router.replace(`/(tabs)/recipes/${recipe.id}` as Href);
    } catch (error) {
      const entitlementFeature = getEntitlementFeatureFromError(error);
      if (entitlementFeature) {
        openPaywall(entitlementFeature);
        return;
      }

      setSubmitError(t('recipeForm.createFailed'));
    }
  };

  return (
    <Box className="flex-1 bg-base" style={{ paddingTop: insets.top }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="button"
            className="mb-4 flex-row items-center gap-2 py-2"
            onPress={() => router.back()}
          >
            <FontAwesome name="chevron-left" size={14} color="#F1F5F9" />
            <Text className="text-ice">{t('common.back')}</Text>
          </Pressable>

          <Heading className="mb-4 text-ice" size="lg">
            {t('recipeForm.newRecipe')}
          </Heading>

          {!recipeEntitlements.canCreateRecipe ? (
            <Box
              className="mb-4 rounded-lg border border-warning/40 bg-warning/15 px-4 py-3"
              testID="recipe-create-limit-alert"
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
          ) : (
            <>
              {submitError ? (
                <Box className="mb-4 rounded-lg bg-red-500/15 px-4 py-3">
                  <Text className="text-sm text-red-400">{submitError}</Text>
                </Box>
              ) : null}
              <RecipeForm
                submitLabel={t('recipeForm.createRecipe')}
                isLoading={createRecipeMutation.isPending}
                onSubmit={handleCreate}
                onCancel={() => router.back()}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Box>
  );
}
