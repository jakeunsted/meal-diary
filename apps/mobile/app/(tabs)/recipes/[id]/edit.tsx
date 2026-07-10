import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeForm, type RecipeFormValues } from '@/components/recipe/RecipeForm';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/lib/queries/profile';
import { useRecipe, useUpdateRecipe } from '@/lib/queries/recipes';
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
  const updateRecipeMutation = useUpdateRecipe();
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!parsedRecipeId) {
    return <Redirect href="/(tabs)/recipes" />;
  }

  const handleUpdate = async (formData: RecipeFormValues) => {
    if (!familyGroupId || !parsedRecipeId) {
      return;
    }

    setSubmitError(null);

    try {
      await updateRecipeMutation.mutateAsync({
        recipeId: parsedRecipeId,
        familyGroupId,
        payload: formData as UpdateRecipePayload,
      });
      router.back();
    } catch {
      setSubmitError(t('recipeForm.updateFailed'));
    }
  };

  const handleCancel = () => {
    router.back();
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
            onPress={handleCancel}
          >
            <FontAwesome name="chevron-left" size={14} color="#F1F5F9" />
            <Text className="text-ice">{t('common.back')}</Text>
          </Pressable>

          <Heading className="mb-4 text-ice" size="lg">
            {t('recipeForm.editRecipe')}
          </Heading>

          {recipeQuery.isLoading ? (
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
                isLoading={updateRecipeMutation.isPending}
                onSubmit={handleUpdate}
                onCancel={handleCancel}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Box>
  );
}
