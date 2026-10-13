import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';

import { DayFoodPlanCard, type SetMealPayload } from '@/components/diary/DayFoodPlanCard';
import { DiarySkeleton } from '@/components/diary/DiarySkeleton';
import { MealSlotsSettingsModal } from '@/components/diary/MealSlotsSettingsModal';
import { SetMealModal } from '@/components/diary/SetMealModal';
import { WeekCalendarPicker } from '@/components/diary/WeekCalendarPicker';
import { WarningAlert } from '@/components/profile/WarningAlert';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { Text } from '@/components/ui/text';
import { captureEvent } from '@/lib/analytics/posthog';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { useDiaryEntitlements } from '@/lib/entitlements/useDiaryEntitlements';
import { getDateForDay, getDayName, isDayInPast } from '@/lib/diary/dateUtils';
import { useMealDiaryEditor } from '@/lib/diary/useMealDiaryEditor';
import { useMealDiaryWeek } from '@/lib/diary/useMealDiaryWeek';
import { buildWeekDayMeals, toMealSlot } from '@/lib/diary/weeklyMeals';
import { useMealSlots } from '@/lib/queries/mealSlots';
import { useCurrentUser, useEntitlements } from '@/lib/queries/profile';
import { mealDiaryKeys } from '@/lib/queries/mealDiary';
import { useQueryClient } from '@tanstack/react-query';

export default function DiaryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userQuery = useCurrentUser();
  const entitlementsQuery = useEntitlements(userQuery.data?.family_group_id);
  const diary = useMealDiaryWeek(userQuery.data?.family_group_id);
  const mealEditor = useMealDiaryEditor();
  const openPaywall = usePaywallStore((state) => state.openPaywall);
  const familyGroupId = userQuery.data?.family_group_id;
  const diaryEntitlements = useDiaryEntitlements(entitlementsQuery.data);
  const mealSlotsQuery = useMealSlots(familyGroupId);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const hasMealData = diary.weeklyMeals.length > 0;
  const showSkeleton = diary.loading && !hasMealData;
  const showWeekLoading = diary.isFetching && hasMealData;
  const weekMeals = buildWeekDayMeals(diary.weeklyMeals, diary.resolvedWeekKey);
  const isWeekReadOnly = diaryEntitlements.isWeekReadOnly(diary.displayWeekStartDate);
  const canCustomizeMealSlots =
    entitlementsQuery.data?.features.custom_meal_slots ?? false;

  const weekReadOnlyMessage = useMemo(() => {
    if (!isWeekReadOnly) {
      return '';
    }

    const billing = entitlementsQuery.data?.billing;
    if (billing?.isOwner) {
      return t('diaryPage.weekReadOnly');
    }

    if (billing?.ownerDisplayName) {
      return `${t('diaryPage.weekReadOnly')} ${t('diaryPage.askOwnerToUpgrade', {
        name: billing.ownerDisplayName,
      })}`;
    }

    return `${t('diaryPage.weekReadOnly')} ${t('diaryPage.askOwnerToUpgradeGeneric')}`;
  }, [entitlementsQuery.data?.billing, isWeekReadOnly, t]);

  useEffect(() => {
    if (familyGroupId) {
      void entitlementsQuery.refetch();
    }
  }, [familyGroupId]);

  useEffect(() => {
    if (!entitlementsQuery.data?.limits) {
      return;
    }

    if (!diaryEntitlements.canNavigateToWeek(diary.displayWeekStartDate)) {
      diary.goToCurrentWeek();
    }
  }, [
    diary.displayWeekStartDate,
    diary.goToCurrentWeek,
    diaryEntitlements.canNavigateToWeek,
    entitlementsQuery.data?.limits,
  ]);

  const handleRefresh = () => {
    void userQuery.refetch();
    void entitlementsQuery.refetch();
    void mealSlotsQuery.refetch();
    void diary.refreshWeek();
  };

  const handleRetry = () => {
    void diary.refreshWeek();
  };

  const handleSetMeal = (payload: SetMealPayload, dayOfWeek: number) => {
    if (isWeekReadOnly) {
      openPaywall('edit_past_weeks');
      return;
    }

    mealEditor.openMealEditor(
      payload.type,
      dayOfWeek,
      diary.weeklyMeals,
      payload.mealSlotId
    );
  };

  const handleSaveMeal = () => {
    void mealEditor.handleSave(familyGroupId, diary.resolvedWeekKey, diary.weeklyMeals);
  };

  const handleClearMeal = () => {
    void mealEditor.handleClear(familyGroupId, diary.resolvedWeekKey, diary.weeklyMeals);
  };

  const handleWeekBlocked = () => {
    openPaywall('weeks_ahead');
  };

  const handleRecipePress = (recipeId: number) => {
    router.push(`/(tabs)/recipes/${recipeId}` as Href);
  };

  const handleOpenSettings = () => {
    captureEvent('diary_settings_opened');
    void mealSlotsQuery.refetch();
    setSettingsVisible(true);
  };

  const handleMealSlotsSaved = () => {
    void mealSlotsQuery.refetch();
    void diary.refreshWeek();
    if (familyGroupId) {
      void queryClient.invalidateQueries({ queryKey: mealDiaryKeys.all });
    }
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
        <Box className="relative mx-4 items-center justify-center">
          <ScreenTitle testID="diary-title">{t('diary.title')}</ScreenTitle>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('diarySettings.open')}
            className="absolute right-0 top-1 h-9 w-9 items-center justify-center rounded-full"
            onPress={handleOpenSettings}
            testID="diary-settings-button"
          >
            <FontAwesome name="cog" size={16} color="rgba(241, 245, 249, 0.85)" />
          </Pressable>
        </Box>

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

        {isWeekReadOnly ? (
          <WarningAlert
            className="mx-4 mb-4"
            message={weekReadOnlyMessage}
            showUpgradeLink={entitlementsQuery.data?.billing.isOwner ?? false}
            testID="diary-week-read-only-alert"
          />
        ) : null}

        {showSkeleton ? (
          <DiarySkeleton />
        ) : (
          <>
            <WeekCalendarPicker
              key={diary.resolvedWeekKey}
              initialWeekStartDate={diary.displayWeekStartDate}
              isCurrentWeek={diary.isCurrentWeek}
              canSelectWeek={diaryEntitlements.canNavigateToWeek}
              onWeekChange={diary.setWeek}
              onGoToThisWeek={diary.goToCurrentWeek}
              onWeekBlocked={handleWeekBlocked}
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
                    slots={dayMeal.slots || []}
                    isPastDay={isDayInPast(diary.resolvedWeekKey, dayMeal.day_of_week)}
                    readOnly={isWeekReadOnly}
                    onSetMeal={(payload) => handleSetMeal(payload, dayMeal.day_of_week)}
                    onRecipePress={handleRecipePress}
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
        familyGroupId={familyGroupId}
        mealName={mealEditor.selectedMeal.name}
        recipeId={mealEditor.selectedMeal.recipeId}
        openedWithMeal={mealEditor.openedWithMeal}
        isLoading={mealEditor.isSaving}
        error={mealEditor.saveError}
        onMealNameChange={mealEditor.updateMealName}
        onRecipeSelect={mealEditor.updateRecipeSelection}
        onSave={handleSaveMeal}
        onClear={handleClearMeal}
        onClose={mealEditor.closeMealEditor}
      />

      <MealSlotsSettingsModal
        visible={settingsVisible}
        familyGroupId={familyGroupId}
        canCustomize={canCustomizeMealSlots}
        initialSlots={mealSlotsQuery.data ?? []}
        onClose={() => setSettingsVisible(false)}
        onSaved={handleMealSlotsSaved}
      />
    </Box>
  );
}
