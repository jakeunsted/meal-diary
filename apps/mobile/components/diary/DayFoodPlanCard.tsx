import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { DayMealSlot, MealType } from '@/types/mealDiary';

interface MealSlotView {
  name: string;
  recipeId: number | null;
}

export interface SetMealPayload {
  type: MealType | null;
  mealSlotId: number | null;
}

interface DayFoodPlanCardProps {
  day: string;
  date: string;
  breakfast?: MealSlotView;
  lunch?: MealSlotView;
  dinner?: MealSlotView;
  slots?: DayMealSlot[];
  isPastDay?: boolean;
  readOnly?: boolean;
  onSetMeal?: (payload: SetMealPayload) => void;
  onRecipePress?: (recipeId: number) => void;
}

interface MealRowProps {
  label: string;
  meal?: MealSlotView;
  readOnly: boolean;
  testIdPrefix: string;
  onSetMeal?: () => void;
  onRecipePress?: (recipeId: number) => void;
}

function MealRow({ label, meal, readOnly, testIdPrefix, onSetMeal, onRecipePress }: MealRowProps) {
  const { t } = useTranslation();

  return (
    <Box className="mb-3 flex-row items-center gap-3" testID={`${testIdPrefix}-row`}>
      <Text className="shrink-0 text-ice font-medium">{label}</Text>
      {meal?.name ? (
        <Box className="min-w-0 flex-1 flex-row items-center justify-end gap-1.5">
          <Pressable
            className="min-w-0 shrink"
            onPress={
              meal.recipeId
                ? onRecipePress
                  ? () => onRecipePress(meal.recipeId!)
                  : undefined
                : readOnly
                  ? undefined
                  : onSetMeal
            }
            disabled={meal.recipeId ? !onRecipePress : readOnly}
            testID={
              meal.recipeId ? `${testIdPrefix}-recipe-badge` : `${testIdPrefix}-custom-badge`
            }
            accessibilityRole="button"
            accessibilityLabel={meal.name}
          >
            <Box className="max-w-full rounded-full bg-primary px-3 py-1">
              <Text className="text-ice text-sm" numberOfLines={1}>
                {meal.name}
              </Text>
            </Box>
          </Pressable>
          {!readOnly ? (
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
        <Box className="flex-1 flex-row justify-end">
          <Button size="sm" variant="outline" onPress={onSetMeal} testID={`set-meal-${testIdPrefix}-button`}>
            <ButtonText>{t('diary.setMeal')}</ButtonText>
          </Button>
        </Box>
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
  slots = [],
  isPastDay = false,
  readOnly = false,
  onSetMeal,
  onRecipePress,
}: DayFoodPlanCardProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(!isPastDay);

  useEffect(() => {
    setIsOpen(!isPastDay);
  }, [isPastDay]);

  const handleToggle = () => {
    setIsOpen((value) => !value);
  };

  const displaySlots = useMemo(() => {
    if (slots.length > 0) {
      return [...slots]
        .sort((a, b) => a.position - b.position)
        .map((slot) => ({
          key: String(slot.meal_slot_id),
          label: slot.name,
          testIdPrefix: slot.legacy_key || `slot-${slot.meal_slot_id}`,
          meal: {
            name: slot.dish || '',
            recipeId: slot.recipe_id,
          },
          payload: {
            type: slot.legacy_key,
            mealSlotId: slot.meal_slot_id,
          } satisfies SetMealPayload,
        }));
    }

    return [
      {
        key: 'breakfast',
        label: t('diary.breakfast'),
        testIdPrefix: 'breakfast',
        meal: breakfast,
        payload: { type: 'breakfast' as const, mealSlotId: null },
      },
      {
        key: 'lunch',
        label: t('diary.lunch'),
        testIdPrefix: 'lunch',
        meal: lunch,
        payload: { type: 'lunch' as const, mealSlotId: null },
      },
      {
        key: 'dinner',
        label: t('diary.dinner'),
        testIdPrefix: 'dinner',
        meal: dinner,
        payload: { type: 'dinner' as const, mealSlotId: null },
      },
    ];
  }, [breakfast, dinner, lunch, slots, t]);

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
          {displaySlots.map((slot) => (
            <MealRow
              key={slot.key}
              label={slot.label}
              meal={slot.meal}
              readOnly={readOnly}
              testIdPrefix={slot.testIdPrefix}
              onSetMeal={onSetMeal ? () => onSetMeal(slot.payload) : undefined}
              onRecipePress={onRecipePress}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
