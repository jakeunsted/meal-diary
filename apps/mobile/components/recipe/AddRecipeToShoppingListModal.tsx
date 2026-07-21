import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatIngredientDisplayLine } from '@/lib/recipe/buildShoppingListItemsFromRecipe';
import type { RecipeIngredient } from '@/types/recipe';

interface AddRecipeToShoppingListModalProps {
  visible: boolean;
  ingredients: RecipeIngredient[];
  isSubmitting?: boolean;
  onConfirm: (selectedKeys: string[]) => void;
  onClose: () => void;
}

function getIngredientKey(ingredient: RecipeIngredient, index: number): string {
  return ingredient.id != null ? String(ingredient.id) : `index-${index}`;
}

export function AddRecipeToShoppingListModal({
  visible,
  ingredients,
  isSubmitting = false,
  onConfirm,
  onClose,
}: AddRecipeToShoppingListModalProps) {
  const { t } = useTranslation();
  const [selectedByKey, setSelectedByKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!visible) {
      return;
    }

    const next: Record<string, boolean> = {};
    ingredients.forEach((ingredient, index) => {
      next[getIngredientKey(ingredient, index)] = false;
    });
    setSelectedByKey(next);
  }, [visible, ingredients]);

  const hasSelection = useMemo(
    () => Object.values(selectedByKey).some((selected) => selected),
    [selectedByKey]
  );

  const handleToggle = (key: string) => {
    setSelectedByKey((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleConfirm = () => {
    const selectedKeys = Object.entries(selectedByKey)
      .filter(([, selected]) => selected)
      .map(([key]) => key);
    onConfirm(selectedKeys);
  };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    onClose();
  };

  return (
    <DialogModal visible={visible} onClose={handleClose}>
      <DialogPanel className="max-h-[80%]">
        <Text className="mb-3 text-base font-semibold text-ice">
          {t('recipeDetail.addToShoppingListModalTitle')}
        </Text>

        <ScrollView
          className="max-h-80"
          keyboardShouldPersistTaps="handled"
          testID="recipe-add-to-shopping-list-modal"
        >
          {ingredients.map((ingredient, index) => {
            const key = getIngredientKey(ingredient, index);
            const isSelected = selectedByKey[key] ?? false;

            return (
              <Pressable
                key={key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                className="mb-2 flex-row items-center gap-3 rounded-lg px-2 py-2"
                onPress={() => handleToggle(key)}
                testID={`recipe-shopping-list-ingredient-${key}`}
              >
                <View
                  className={`h-5 w-5 items-center justify-center rounded border ${
                    isSelected ? 'border-primary bg-primary' : 'border-white/20'
                  }`}
                >
                  {isSelected ? <FontAwesome name="check" size={10} color="#F1F5F9" /> : null}
                </View>
                <Text className="flex-1 text-ice">{formatIngredientDisplayLine(ingredient)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Box className="mt-4 flex-row justify-end gap-3">
          <Button variant="outline" onPress={handleClose} disabled={isSubmitting}>
            <ButtonText>{t('common.cancel')}</ButtonText>
          </Button>
          <Button
            className="bg-primary"
            onPress={handleConfirm}
            disabled={!hasSelection || isSubmitting}
            testID="recipe-add-to-list-confirm-button"
          >
            {isSubmitting ? <ButtonSpinner color="#F1F5F9" /> : null}
            <ButtonText className="text-ice">{t('recipeDetail.addToList')}</ButtonText>
          </Button>
        </Box>
      </DialogPanel>
    </DialogModal>
  );
}
