import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { MealType } from '@/types/mealDiary';

interface MealSlot {
  name: string;
  recipeId: number | null;
}

interface DayFoodPlanCardProps {
  day: string;
  date: string;
  breakfast?: MealSlot;
  lunch?: MealSlot;
  dinner?: MealSlot;
  isPastDay?: boolean;
  readOnly?: boolean;
  onSetMeal?: (mealType: MealType) => void;
}

interface MealRowProps {
  label: string;
  meal?: MealSlot;
  readOnly: boolean;
  testIdPrefix: string;
  onSetMeal?: () => void;
}

function MealRow({ label, meal, readOnly, testIdPrefix, onSetMeal }: MealRowProps) {
  const { t } = useTranslation();

  return (
    <Box className="mb-3 flex-row items-center justify-between" testID={`${testIdPrefix}-row`}>
      <Text className="text-ice font-medium">{label}</Text>
      {meal?.name ? (
        <Box className="max-w-[60%] flex-row items-center gap-1">
          {meal.recipeId ? (
            <Box
              className="rounded-full bg-primary px-3 py-1"
              testID={`${testIdPrefix}-recipe-badge`}
            >
              <Text className="text-ice text-sm">{meal.name}</Text>
            </Box>
          ) : (
            <Pressable
              onPress={readOnly ? undefined : onSetMeal}
              disabled={readOnly}
              testID={`${testIdPrefix}-custom-badge`}
              accessibilityRole="button"
            >
              <Box className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-1">
                <Text className="text-ice text-sm">{meal.name}</Text>
                {!readOnly ? (
                  <FontAwesome name="pencil" size={12} color="rgba(241, 245, 249, 0.7)" />
                ) : null}
              </Box>
            </Pressable>
          )}
          {meal.recipeId && !readOnly ? (
            <Pressable
              onPress={onSetMeal}
              testID={`edit-${testIdPrefix}-button`}
              accessibilityRole="button"
            >
              <FontAwesome name="pencil" size={12} color="rgba(241, 245, 249, 0.7)" />
            </Pressable>
          ) : null}
        </Box>
      ) : !readOnly ? (
        <Button size="sm" variant="outline" onPress={onSetMeal} testID={`set-meal-${testIdPrefix}-button`}>
          <ButtonText>{t('diary.setMeal')}</ButtonText>
        </Button>
      ) : null}
    </Box>
  );
}

export function DayFoodPlanCard({
  day,
  date,
  breakfast,
  lunch,
  dinner,
  isPastDay = false,
  readOnly = false,
  onSetMeal,
}: DayFoodPlanCardProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(!isPastDay);

  useEffect(() => {
    setIsOpen(!isPastDay);
  }, [isPastDay]);

  const handleToggle = () => {
    setIsOpen((value) => !value);
  };

  return (
    <Box className="mx-4 mb-4 overflow-hidden rounded-2xl bg-surface" testID="day-food-plan-card">
      <Pressable
        className="flex-row items-center justify-between px-6 py-4"
        onPress={handleToggle}
        testID="day-card-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        <Text className="text-ice font-semibold">
          {day} - {date}
        </Text>
        <FontAwesome
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="rgba(241, 245, 249, 0.7)"
        />
      </Pressable>

      {isOpen ? (
        <Box className="bg-base px-6 pb-5 pt-2">
          <MealRow
            label={t('diary.breakfast')}
            meal={breakfast}
            readOnly={readOnly}
            testIdPrefix="breakfast"
            onSetMeal={onSetMeal ? () => onSetMeal('breakfast') : undefined}
          />
          <MealRow
            label={t('diary.lunch')}
            meal={lunch}
            readOnly={readOnly}
            testIdPrefix="lunch"
            onSetMeal={onSetMeal ? () => onSetMeal('lunch') : undefined}
          />
          <MealRow
            label={t('diary.dinner')}
            meal={dinner}
            readOnly={readOnly}
            testIdPrefix="dinner"
            onSetMeal={onSetMeal ? () => onSetMeal('dinner') : undefined}
          />
        </Box>
      ) : null}
    </Box>
  );
}
