import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
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
  isLoading = false,
  error = null,
  onMealNameChange,
  onRecipeSelect,
  onSave,
  onClear,
  onClose,
}: SetMealModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [recipePickerVisible, setRecipePickerVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const recipesQuery = useFamilyRecipes(familyGroupId, { enabled: visible });

  const recipes = recipesQuery.data ?? [];
  const hasRecipes = recipes.length > 0;

  const hasExistingMeal = !!(mealName && mealName.trim()) || !!recipeId;
  const canSave =
    !!(mealName && mealName.trim()) || !!recipeId || hasExistingMeal;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
    }
  }, [visible]);

  const handleClose = () => {
    if (isLoading) {
      return;
    }
    setRecipePickerVisible(false);
    onClose();
  };

  const handleSelectRecipe = (selectedRecipeId: number | null, name: string) => {
    onRecipeSelect(selectedRecipeId, name);
    setRecipePickerVisible(false);
  };

  const recipeSelectLabel = recipeId
    ? mealName
    : `— ${t('diary.orTypeMealName')} —`;

  const keyboardOffset = Math.max(0, keyboardHeight - insets.bottom);

  return (
    <>
      <DialogModal
        visible={visible}
        onClose={handleClose}
        testID="set-meal-modal"
        keyboardInset={keyboardOffset}
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
                onSubmitEditing={onSave}
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
            {hasExistingMeal ? (
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
              variant="outline"
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
      </DialogModal>

      <DialogModal
        visible={recipePickerVisible}
        onClose={() => setRecipePickerVisible(false)}
        placement="bottom"
      >
        <DialogPanel className="w-full max-h-[70%] rounded-t-2xl bg-surface p-4">
          <Text className="text-ice mb-3 text-center text-base font-semibold">
            {t('diary.selectRecipe')}
          </Text>
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
            {recipes.map((recipe) => {
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
          <Button variant="outline" onPress={() => setRecipePickerVisible(false)} className="mt-2">
            <ButtonText>{t('common.close')}</ButtonText>
          </Button>
        </DialogPanel>
      </DialogModal>
    </>
  );
}
