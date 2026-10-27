import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';

interface RecipeCategoryOption {
  id: number;
  name: string;
  assignable: boolean;
}

interface LockedRecipeCategory {
  id: number;
  name: string;
}

interface RecipeCategoryFieldProps {
  options: readonly RecipeCategoryOption[];
  selectedIds: readonly number[];
  lockedCategories: readonly LockedRecipeCategory[];
  isLoading?: boolean;
  showAddCustom: boolean;
  errorMessage?: string | null;
  onToggle: (categoryId: number) => void;
  onRemoveLocked: (categoryId: number) => void;
  onAddCustom: () => void;
}

export function RecipeCategoryField({
  options,
  selectedIds,
  lockedCategories,
  isLoading = false,
  showAddCustom,
  errorMessage = null,
  onToggle,
  onRemoveLocked,
  onAddCustom,
}: RecipeCategoryFieldProps) {
  const { t } = useTranslation();
  const showField =
    isLoading ||
    options.length > 0 ||
    lockedCategories.length > 0 ||
    showAddCustom ||
    Boolean(errorMessage);

  if (!showField) {
    return null;
  }

  return (
    <Box testID="recipe-category-field">
      <Text className="mb-2 text-sm font-semibold text-ice">
        {t('recipes.categories.fieldLabel')}
      </Text>
      <View className="gap-2">
        {isLoading ? <ActivityIndicator size="small" color="#6366F1" /> : null}
        {options.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {options.map((category) => {
              const selected = selectedIds.includes(category.id);

              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  className={`rounded-full px-3 py-2 ${selected ? 'bg-primary' : 'bg-ice/10'}`}
                  onPress={() => onToggle(category.id)}
                  testID={`recipe-category-option-${category.id}`}
                >
                  <Text
                    className={`text-sm ${selected ? 'font-semibold text-ice' : 'text-ice/80'}`}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {lockedCategories.map((category) => (
          <View
            key={category.id}
            className="rounded-xl border border-white/10 bg-surface px-3 py-3"
            testID={`recipe-category-locked-${category.id}`}
          >
            <Text className="text-sm font-medium text-ice">{category.name}</Text>
            <Text className="mt-1 text-xs text-ice/60">
              {t('recipes.categories.assignedLocked')}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-2 self-start"
              onPress={() => onRemoveLocked(category.id)}
              testID={`recipe-category-remove-${category.id}`}
            >
              <Text className="text-sm text-red-400">{t('recipes.categories.remove')}</Text>
            </Pressable>
          </View>
        ))}

        {showAddCustom ? (
          <Pressable
            accessibilityRole="button"
            className="self-start rounded-full bg-ice/10 px-3 py-2"
            onPress={onAddCustom}
            testID="recipe-category-add-custom"
          >
            <Text className="text-sm text-ice/80">{t('recipes.categories.addCustom')}</Text>
          </Pressable>
        ) : null}
        {errorMessage ? (
          <Text className="text-sm text-red-400" testID="recipe-category-field-error">
            {errorMessage}
          </Text>
        ) : null}
      </View>
    </Box>
  );
}
