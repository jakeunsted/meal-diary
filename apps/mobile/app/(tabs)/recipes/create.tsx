import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeForm, type RecipeFormValues } from '@/components/recipe/RecipeForm';
import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';
import { getEntitlementFeatureFromError } from '@/lib/entitlements/entitlementErrors';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { useRecipeEntitlements } from '@/lib/entitlements/useRecipeEntitlements';
import { useCurrentUser, useEntitlements } from '@/lib/queries/profile';
import { useCreateRecipe, useImportRecipeFromUrl } from '@/lib/queries/recipes';
import type { CreateRecipePayload, ImportRecipeFromUrlPayload } from '@/types/recipe';

export default function CreateRecipeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const entitlementsQuery = useEntitlements(familyGroupId);
  const recipeEntitlements = useRecipeEntitlements(entitlementsQuery.data);
  const createRecipeMutation = useCreateRecipe();
  const importRecipeMutation = useImportRecipeFromUrl();
  const openPaywall = usePaywallStore((state) => state.openPaywall);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [creationMode, setCreationMode] = useState<'manual' | 'import' | null>(null);
  const [creationMethodVisible, setCreationMethodVisible] = useState(true);
  const [importUrl, setImportUrl] = useState('');
  const [importProgressStep, setImportProgressStep] = useState(0);

  useEffect(() => {
    if (!importRecipeMutation.isPending) {
      setImportProgressStep(0);
      return;
    }

    const fetchingTimeout = setTimeout(() => setImportProgressStep(1), 900);
    const creatingTimeout = setTimeout(() => setImportProgressStep(2), 1800);

    return () => {
      clearTimeout(fetchingTimeout);
      clearTimeout(creatingTimeout);
    };
  }, [importRecipeMutation.isPending]);

  const handleOpenPlans = () => {
    void Linking.openURL(`${env.webUrl}/plans`);
  };

  const handleCloseMethodDialog = () => {
    if (creationMode) {
      setCreationMethodVisible(false);
      return;
    }

    router.back();
  };

  const handleSelectCreationMode = (mode: 'manual' | 'import') => {
    setCreationMode(mode);
    setCreationMethodVisible(false);
    setSubmitError(null);
    setImportError(null);
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

  const handleImportRecipe = async () => {
    if (!familyGroupId || !importUrl.trim()) {
      return;
    }

    if (!recipeEntitlements.canCreateRecipe) {
      openPaywall('recipes');
      return;
    }

    setImportError(null);

    try {
      const recipe = await importRecipeMutation.mutateAsync({
        familyGroupId,
        payload: { url: importUrl.trim() } as ImportRecipeFromUrlPayload,
      });
      void entitlementsQuery.refetch();
      router.replace(`/(tabs)/recipes/${recipe.id}/edit` as Href);
    } catch (error) {
      const entitlementFeature = getEntitlementFeatureFromError(error);
      if (entitlementFeature) {
        openPaywall(entitlementFeature);
        return;
      }

      setImportError(error instanceof Error ? error.message : t('recipeImport.genericError'));
    }
  };

  const importProgressMessages = [
    t('recipeImport.progress.validating'),
    t('recipeImport.progress.fetching'),
    t('recipeImport.progress.creating'),
  ];
  const importInputClassName =
    'rounded-lg border border-white/10 bg-surface px-4 py-3 text-base text-ice';

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
              {creationMode ? (
                <Box className="mb-4">
                  <Button variant="outline" size="sm" onPress={() => setCreationMethodVisible(true)}>
                    <ButtonText>{t('recipeImport.changeMethod')}</ButtonText>
                  </Button>
                </Box>
              ) : null}

              {creationMode === 'import' ? (
                <Box className="rounded-2xl border border-white/10 bg-surface px-4 py-4">
                  <Heading className="text-ice" size="md">
                    {t('recipeImport.title')}
                  </Heading>
                  <Text className="mt-2 text-sm text-ice/70">
                    {t('recipeImport.description')}
                  </Text>

                  <Text className="mb-2 mt-4 text-sm font-semibold text-ice">
                    {t('recipeImport.urlLabel')}
                  </Text>
                  <TextInput
                    className={importInputClassName}
                    placeholder={t('recipeImport.urlPlaceholder')}
                    placeholderTextColor="rgba(241, 245, 249, 0.4)"
                    value={importUrl}
                    onChangeText={setImportUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    editable={!importRecipeMutation.isPending}
                    testID="recipe-import-url-input"
                  />

                  {importError ? (
                    <Box className="mt-4 rounded-lg bg-red-500/15 px-4 py-3" testID="recipe-import-error">
                      <Text className="text-sm text-red-400">{importError}</Text>
                    </Box>
                  ) : null}

                  {importRecipeMutation.isPending ? (
                    <Box
                      className="mt-4 rounded-lg bg-primary/15 px-4 py-3"
                      testID="recipe-import-loading"
                    >
                      <Text className="text-sm font-semibold text-ice">
                        {t('recipeImport.loadingTitle')}
                      </Text>
                      <Text className="mt-1 text-sm text-ice/80">
                        {importProgressMessages[importProgressStep]}
                      </Text>
                    </Box>
                  ) : null}

                  <Box className="mt-4 flex-row justify-end gap-2">
                    <Button
                      variant="ghost"
                      onPress={() => router.back()}
                      disabled={importRecipeMutation.isPending}
                    >
                      <ButtonText>{t('common.cancel')}</ButtonText>
                    </Button>
                    <Button
                      className="bg-primary"
                      onPress={handleImportRecipe}
                      disabled={!importUrl.trim() || importRecipeMutation.isPending}
                      testID="recipe-import-submit-button"
                    >
                      {importRecipeMutation.isPending ? <ButtonSpinner color="#F1F5F9" /> : null}
                      <ButtonText className="text-ice">{t('recipeImport.submit')}</ButtonText>
                    </Button>
                  </Box>
                </Box>
              ) : creationMode === 'manual' ? (
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
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <DialogModal visible={creationMethodVisible} onClose={handleCloseMethodDialog}>
        <DialogPanel>
          <Heading size="lg" className="mb-3 text-ice">
            {t('recipeImport.chooseMethodTitle')}
          </Heading>
          <Text className="mb-6 text-ice/80">{t('recipeImport.chooseMethodDescription')}</Text>
          <Box className="gap-3">
            <Pressable
              accessibilityRole="button"
              className="rounded-xl border border-white/10 bg-base px-4 py-4"
              onPress={() => handleSelectCreationMode('manual')}
              testID="recipe-create-method-manual"
            >
              <Text className="font-semibold text-ice">{t('recipeImport.manualOptionTitle')}</Text>
              <Text className="mt-1 text-sm text-ice/70">
                {t('recipeImport.manualOptionDescription')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="rounded-xl border border-white/10 bg-base px-4 py-4"
              onPress={() => handleSelectCreationMode('import')}
              testID="recipe-create-method-import"
            >
              <Text className="font-semibold text-ice">{t('recipeImport.importOptionTitle')}</Text>
              <Text className="mt-1 text-sm text-ice/70">
                {t('recipeImport.importOptionDescription')}
              </Text>
            </Pressable>
          </Box>
          <Box className="mt-6 flex-row justify-end">
            <Button variant="ghost" onPress={handleCloseMethodDialog}>
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
          </Box>
        </DialogPanel>
      </DialogModal>
    </Box>
  );
}
