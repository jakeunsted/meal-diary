import type { RecipeCategoryFilter, RecipeCategoryTabCounts } from '@meal-diary/shared';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';

interface RecipeCategoryTabOption {
  id: number;
  name: string;
}

interface RecipeCategoryTabsProps {
  categories: readonly RecipeCategoryTabOption[];
  selected: RecipeCategoryFilter;
  counts: RecipeCategoryTabCounts;
  onChange: (filter: RecipeCategoryFilter) => void;
}

export function RecipeCategoryTabs({
  categories,
  selected,
  counts,
  onChange,
}: RecipeCategoryTabsProps) {
  const { t } = useTranslation();
  const allSelected = selected.kind === 'all';
  const uncategorizedSelected = selected.kind === 'uncategorized';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-3"
      contentContainerClassName="gap-2 px-0"
      testID="recipe-category-tabs"
    >
      <RecipeCategoryChip
        label={t('recipes.categories.all')}
        count={counts.all}
        selected={allSelected}
        testID="recipe-category-tab-all"
        countTestID="recipe-category-tab-count-all"
        onPress={() => onChange({ kind: 'all' })}
      />
      {categories.map((category) => {
        const isSelected = selected.kind === 'category' && selected.categoryId === category.id;

        return (
          <RecipeCategoryChip
            key={category.id}
            label={category.name}
            count={counts.byId[category.id] ?? 0}
            selected={isSelected}
            testID={`recipe-category-tab-${category.id}`}
            countTestID={`recipe-category-tab-count-${category.id}`}
            onPress={() => onChange({ kind: 'category', categoryId: category.id })}
          />
        );
      })}
      <RecipeCategoryChip
        label={t('recipes.categories.uncategorized')}
        count={counts.uncategorized}
        selected={uncategorizedSelected}
        testID="recipe-category-tab-uncategorized"
        countTestID="recipe-category-tab-count-uncategorized"
        onPress={() => onChange({ kind: 'uncategorized' })}
      />
    </ScrollView>
  );
}

interface RecipeCategoryChipProps {
  label: string;
  count: number;
  selected: boolean;
  testID: string;
  countTestID: string;
  onPress: () => void;
}

function RecipeCategoryChip({
  label,
  count,
  selected,
  testID,
  countTestID,
  onPress,
}: RecipeCategoryChipProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      className={`flex-row items-center rounded-full px-3 py-2 ${
        selected ? 'bg-primary' : 'bg-ice/10'
      }`}
      onPress={onPress}
      testID={testID}
    >
      <Text className={`text-sm ${selected ? 'text-ice font-semibold' : 'text-ice/80'}`}>
        {label}
      </Text>
      <Box
        className={`ml-1.5 min-w-5 items-center rounded-full px-1.5 ${
          selected ? 'bg-ice/20' : 'bg-ice/10'
        }`}
        testID={countTestID}
      >
        <Text className={`text-xs ${selected ? 'text-ice' : 'text-ice/70'}`}>{count}</Text>
      </Box>
    </Pressable>
  );
}
