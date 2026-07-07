import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, TextInput } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';

interface SetMealModalProps {
  visible: boolean;
  mealName: string;
  recipeId: number | null;
  isLoading?: boolean;
  error?: string | null;
  onMealNameChange: (name: string) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
}

export function SetMealModal({
  visible,
  mealName,
  recipeId,
  isLoading = false,
  error = null,
  onMealNameChange,
  onSave,
  onClear,
  onClose,
}: SetMealModalProps) {
  const { t } = useTranslation();

  const hasExistingMeal = !!(mealName && mealName.trim()) || !!recipeId;
  const canSave =
    !!(mealName && mealName.trim()) || !!recipeId || hasExistingMeal;

  const handleClose = () => {
    if (isLoading) {
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      testID="set-meal-modal"
    >
      <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={handleClose}>
        <Pressable className="w-full rounded-2xl bg-surface p-6" onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Heading size="lg" className="text-ice mb-4">
              {t('diary.setMealTitle')}
            </Heading>

            {recipeId && mealName ? (
              <Box
                className="bg-primary/20 mb-4 self-start rounded-full px-3 py-1"
                testID="set-meal-selected-recipe"
              >
                <Text className="text-primary text-sm">{mealName}</Text>
              </Box>
            ) : (
              <TextInput
                className="text-ice mb-4 rounded-lg bg-base px-4 py-3"
                placeholder={t('diary.mealName')}
                placeholderTextColor="rgba(241, 245, 249, 0.4)"
                value={mealName}
                onChangeText={onMealNameChange}
                onSubmitEditing={onSave}
                editable={!isLoading}
                testID="set-meal-name-input"
              />
            )}

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
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
