import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { DialogModal, DialogPanel, dialogBackdropStyle } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/theme';
import { useFamilyRecipes } from '@/lib/queries/recipes';

interface SetMealModalProps {
  visible: boolean;
  familyGroupId?: number;
  mealName: string;
  recipeId: number | null;
  openedWithMeal?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onMealNameChange: (name: string) => void;
  onRecipeSelect: (recipeId: number | null, name: string) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
}

export function SetMealModal({
  visible,
  familyGroupId,
  mealName,
  recipeId,
  openedWithMeal = false,
  isLoading = false,
  error = null,
  onMealNameChange,
  onRecipeSelect,
  onSave,
  onClear,
  onClose,
}: SetMealModalProps) {
  const { t } = useTranslation();
  const [recipePickerVisible, setRecipePickerVisible] = useState(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const recipesQuery = useFamilyRecipes(familyGroupId, { enabled: visible });

  const recipes = recipesQuery.data ?? [];
  const hasRecipes = recipes.length > 0;
  const filteredRecipes = useMemo(() => {
    const query = recipeSearchQuery.trim().toLowerCase();
    if (!query) {
      return recipes;
    }

    return recipes.filter((recipe) => recipe.name.toLowerCase().includes(query));
  }, [recipes, recipeSearchQuery]);

  const canSave =
    !!(mealName && mealName.trim()) || !!recipeId || openedWithMeal;

  const handleClose = () => {
    if (isLoading) {
      return;
    }
    setRecipePickerVisible(false);
    setRecipeSearchQuery('');
    onClose();
  };

  const handleCloseRecipePicker = () => {
    setRecipePickerVisible(false);
    setRecipeSearchQuery('');
  };

  const handleSelectRecipe = (selectedRecipeId: number | null, name: string) => {
    onRecipeSelect(selectedRecipeId, name);
    handleCloseRecipePicker();
  };

  const recipeSelectLabel = recipeId
    ? mealName
    : `— ${t('diary.orTypeMealName')} —`;

  return (
    <DialogModal
      visible={visible}
      onClose={handleClose}
      testID="set-meal-modal"
    >
        <DialogPanel>
          <Heading size="lg" className="text-ice mb-4">
            {t('diary.setMealTitle')}
          </Heading>

          {hasRecipes ? (
            <Box className="mb-4">
              <Text className="text-ice/70 mb-2 text-sm">{t('diary.selectRecipe')}</Text>
              <Pressable
                onPress={() => setRecipePickerVisible(true)}
                className="border-ice/20 bg-base rounded-lg border px-4 py-3"
                testID="set-meal-recipe-select"
                accessibilityLabel={recipeSelectLabel}
              >
                <Text className="text-ice text-sm" numberOfLines={1}>
                  {recipeSelectLabel}
                </Text>
              </Pressable>
            </Box>
          ) : recipesQuery.isLoading ? (
            <Box className="mb-4 items-center py-2">
              <ActivityIndicator size="small" color="#6366F1" />
            </Box>
          ) : null}

          {recipeId && mealName ? (
            <Box
              className="bg-primary/20 mb-4 max-w-full self-start rounded-2xl px-4 py-2"
              testID="set-meal-selected-recipe"
            >
              <Text className="text-primary text-sm">{mealName}</Text>
            </Box>
          ) : !recipeId ? (
            <Box className="mb-4">
              <Text className="text-ice/70 mb-2 text-sm">{t('diary.mealName')}</Text>
              <TextInput
                style={{
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor: colors.base,
                  color: colors.ice,
                }}
                placeholder={t('diary.mealName')}
                placeholderTextColor="rgba(241, 245, 249, 0.4)"
                value={mealName}
                onChangeText={onMealNameChange}
                onSubmitEditing={canSave ? onSave : undefined}
                editable={!isLoading}
                testID="set-meal-name-input"
              />
            </Box>
          ) : null}

          {error ? (
            <Box className="mb-4 rounded-lg bg-red-500/15 px-4 py-3">
              <Text className="text-red-400 text-sm">{error}</Text>
            </Box>
          ) : null}

          <Box className="items-center gap-2">
            {openedWithMeal ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={isLoading}
                onPress={onClear}
                testID="set-meal-clear-button"
              >
                <ButtonText>{t('diary.clearMeal')}</ButtonText>
              </Button>
            ) : null}

            <Button
              variant="default"
              size="sm"
              disabled={isLoading || !canSave}
              onPress={onSave}
              testID="set-meal-save-button"
            >
              {isLoading ? <ButtonSpinner color="#6366F1" /> : null}
              <ButtonText>{t('diary.save')}</ButtonText>
            </Button>
          </Box>
        </DialogPanel>

        {recipePickerVisible ? (
          <View style={[StyleSheet.absoluteFill, styles.recipePicker]}>
            <Pressable
              style={[StyleSheet.absoluteFill, dialogBackdropStyle]}
              onPress={handleCloseRecipePicker}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            />
            <DialogPanel className="w-full max-h-[70%] rounded-t-2xl bg-surface p-4">
              <Text className="text-ice mb-3 text-center text-base font-semibold">
                {t('diary.selectRecipe')}
              </Text>
              <View className="mb-3 flex-row items-center rounded-lg border border-white/10 bg-surface">
                <View className="pl-3">
                  <FontAwesome name="search" size={14} color="rgba(241, 245, 249, 0.5)" />
                </View>
                <TextInput
                  className="min-w-0 flex-1 py-3 pr-3 pl-2 text-base text-ice"
                  placeholder={t('recipeForm.searchPlaceholder')}
                  placeholderTextColor="rgba(241, 245, 249, 0.4)"
                  value={recipeSearchQuery}
                  onChangeText={setRecipeSearchQuery}
                  autoCorrect={false}
                  testID="set-meal-recipe-search"
                />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Pressable
                  onPress={() => handleSelectRecipe(null, '')}
                  className={`mb-2 rounded-lg px-4 py-3 ${!recipeId ? 'bg-primary/20' : 'bg-base'}`}
                  testID="set-meal-recipe-option-custom"
                >
                  <Text className={`text-sm ${!recipeId ? 'text-primary' : 'text-ice'}`}>
                    — {t('diary.orTypeMealName')} —
                  </Text>
                </Pressable>
                {recipeSearchQuery.trim() && filteredRecipes.length === 0 ? (
                  <Text className="text-ice/70 px-4 py-3 text-sm">
                    {t('recipeForm.noResultsTitle')}
                  </Text>
                ) : null}
                {filteredRecipes.map((recipe) => {
                  const isSelected = recipeId === recipe.id;
                  return (
                    <Pressable
                      key={recipe.id}
                      onPress={() => handleSelectRecipe(recipe.id, recipe.name)}
                      className={`mb-2 rounded-lg px-4 py-3 ${isSelected ? 'bg-primary/20' : 'bg-base'}`}
                      testID={`set-meal-recipe-option-${recipe.id}`}
                    >
                      <Text
                        className={`text-sm ${isSelected ? 'text-primary' : 'text-ice'}`}
                        numberOfLines={2}
                      >
                        {recipe.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Button variant="outline" onPress={handleCloseRecipePicker} className="mt-2">
                <ButtonText>{t('common.close')}</ButtonText>
              </Button>
            </DialogPanel>
          </View>
        ) : null}
    </DialogModal>
  );
}

const styles = StyleSheet.create({
  recipePicker: {
    zIndex: 2,
    elevation: 25,
    justifyContent: 'flex-end',
  },
});
