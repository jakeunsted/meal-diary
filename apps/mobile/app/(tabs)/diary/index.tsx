import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayFoodPlanCard } from '@/components/diary/DayFoodPlanCard';
import { DiarySkeleton } from '@/components/diary/DiarySkeleton';
import { SetMealModal } from '@/components/diary/SetMealModal';
import { WeekCalendarPicker } from '@/components/diary/WeekCalendarPicker';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { getDateForDay, getDayName, isDayInPast } from '@/lib/diary/dateUtils';
import { useMealDiaryEditor } from '@/lib/diary/useMealDiaryEditor';
import { useMealDiaryWeek } from '@/lib/diary/useMealDiaryWeek';
import { buildWeekDayMeals, toMealSlot } from '@/lib/diary/weeklyMeals';
import { useCurrentUser } from '@/lib/queries/profile';
import type { MealType } from '@/types/mealDiary';

export default function DiaryScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const userQuery = useCurrentUser();
  const diary = useMealDiaryWeek(userQuery.data?.family_group_id);
  const mealEditor = useMealDiaryEditor();
  const familyGroupId = userQuery.data?.family_group_id;

  const hasMealData = diary.weeklyMeals.length > 0;
  const showSkeleton = diary.loading && !hasMealData;
  const showWeekLoading = diary.isFetching && hasMealData;
  const weekMeals = buildWeekDayMeals(diary.weeklyMeals, diary.resolvedWeekKey);

  const handleRefresh = () => {
    void userQuery.refetch();
    void diary.refreshWeek();
  };

  const handleRetry = () => {
    void diary.refreshWeek();
  };

  const handleSetMeal = (mealType: MealType, dayOfWeek: number) => {
    mealEditor.openMealEditor(mealType, dayOfWeek, diary.weeklyMeals);
  };

  const handleSaveMeal = () => {
    void mealEditor.handleSave(familyGroupId, diary.resolvedWeekKey, diary.weeklyMeals);
  };

  const handleClearMeal = () => {
    void mealEditor.handleClear(familyGroupId, diary.resolvedWeekKey, diary.weeklyMeals);
  };

  return (
    <Box className="flex-1 bg-base">
      <ScrollView
        contentContainerClassName="pb-8"
        contentContainerStyle={{ paddingTop: insets.top + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={diary.isFetching && !diary.loading}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
      >
        <Heading size="2xl" className="text-ice mb-4 text-center" testID="diary-title">
          {t('diary.title')}
        </Heading>

        {diary.lastFetchError && !diary.loading ? (
          <Box
            className="mx-4 mb-4 flex-row items-center justify-between rounded-xl bg-red-500/15 px-4 py-3"
            testID="diary-load-error"
          >
            <Text className="text-red-400 flex-1 text-sm">{t('diary.loadFailed')}</Text>
            <Button
              size="sm"
              variant="outline"
              onPress={handleRetry}
              testID="diary-retry-button"
            >
              <ButtonText>{t('diary.retry')}</ButtonText>
            </Button>
          </Box>
        ) : null}

        {showSkeleton ? (
          <DiarySkeleton />
        ) : (
          <>
            <WeekCalendarPicker
              key={diary.resolvedWeekKey}
              initialWeekStartDate={diary.displayWeekStartDate}
              isCurrentWeek={diary.isCurrentWeek}
              canSelectWeek={() => true}
              onWeekChange={diary.setWeek}
              onGoToThisWeek={diary.goToCurrentWeek}
            />
            <Box className="relative">
              <Box className={showWeekLoading ? 'opacity-50' : ''}>
                {weekMeals.map((dayMeal) => (
                  <DayFoodPlanCard
                    key={`${diary.resolvedWeekKey}-${dayMeal.day_of_week}`}
                    day={getDayName(dayMeal.day_of_week, diary.resolvedWeekKey, i18n.language)}
                    date={getDateForDay(diary.resolvedWeekKey, dayMeal.day_of_week, i18n.language)}
                    breakfast={toMealSlot(dayMeal.breakfast, dayMeal.breakfast_recipe_id)}
                    lunch={toMealSlot(dayMeal.lunch, dayMeal.lunch_recipe_id)}
                    dinner={toMealSlot(dayMeal.dinner, dayMeal.dinner_recipe_id)}
                    isPastDay={isDayInPast(diary.resolvedWeekKey, dayMeal.day_of_week)}
                    onSetMeal={(mealType) => handleSetMeal(mealType, dayMeal.day_of_week)}
                  />
                ))}
              </Box>

              {showWeekLoading ? (
                <Box
                  className="absolute inset-0 items-center justify-center"
                  testID="diary-week-loading"
                >
                  <ActivityIndicator size="large" color="#6366F1" />
                </Box>
              ) : null}
            </Box>
          </>
        )}
      </ScrollView>

      <SetMealModal
        visible={mealEditor.isModalVisible}
        mealName={mealEditor.selectedMeal.name}
        recipeId={mealEditor.selectedMeal.recipeId}
        isLoading={mealEditor.isSaving}
        error={mealEditor.saveError}
        onMealNameChange={mealEditor.updateMealName}
        onSave={handleSaveMeal}
        onClear={handleClearMeal}
        onClose={mealEditor.closeMealEditor}
      />
    </Box>
  );
}
