import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';

import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  formatWeekOptionLabel,
  getViewingWeekMessageKey,
  type WeekCalendarEntitlementOptions,
} from '@/lib/diary/weekCalendar';
import { useWeekCalendar } from '@/lib/diary/useWeekCalendar';

interface WeekCalendarPickerProps {
  initialWeekStartDate: Date | null;
  isCurrentWeek: boolean;
  canSelectWeek?: (weekStart: Date) => boolean;
  onWeekChange: (weekStartDate: Date) => void;
  onGoToThisWeek: () => void;
  onWeekBlocked?: () => void;
}

export function WeekCalendarPicker({
  initialWeekStartDate,
  isCurrentWeek,
  canSelectWeek,
  onWeekChange,
  onGoToThisWeek,
  onWeekBlocked,
}: WeekCalendarPickerProps) {
  const { t } = useTranslation();
  const [weekPickerVisible, setWeekPickerVisible] = useState(false);

  const entitlementOptions = useMemo<WeekCalendarEntitlementOptions>(
    () => ({
      canSelectWeek: canSelectWeek ?? undefined,
      onWeekBlocked,
    }),
    [canSelectWeek, onWeekBlocked]
  );

  const {
    selectedYear,
    selectedWeekKey,
    filteredWeeks,
    canGoBack,
    canGoForward,
    handlePreviousWeek,
    handleNextWeek,
    handleWeekSelect,
    getSelectedWeekStartDate,
  } = useWeekCalendar(initialWeekStartDate, entitlementOptions);

  const viewingWeekMessageKey = getViewingWeekMessageKey(getSelectedWeekStartDate());

  const selectedWeekLabel = useMemo(() => {
    const selected = filteredWeeks.find((week) => `${week.year}-${week.number}` === selectedWeekKey);
    if (!selected) {
      return t('diary.weekSelection');
    }
    return formatWeekOptionLabel(selected, selectedYear, t('diary.week'));
  }, [filteredWeeks, selectedWeekKey, selectedYear, t]);

  const emitWeekChange = (result: Date | 'blocked' | null) => {
    if (result === 'blocked') {
      onWeekBlocked?.();
      return;
    }
    if (result) {
      onWeekChange(result);
    }
  };

  const handlePressPreviousWeek = () => {
    const result = handlePreviousWeek();
    if (result) {
      onWeekChange(result);
    }
  };

  const handlePressNextWeek = () => {
    emitWeekChange(handleNextWeek());
  };

  const handlePressWeekOption = (year: number, week: number) => {
    emitWeekChange(handleWeekSelect(year, week));
    setWeekPickerVisible(false);
  };

  return (
    <Box className="px-4 pb-4">
      <Text className="text-ice/70 mb-2 text-center text-sm">{t('diary.weekSelection')}</Text>

      {!isCurrentWeek ? (
        <Box className="border-primary/20 bg-primary/5 mb-3 flex-col items-center justify-center gap-2 rounded-xl border px-4 py-2.5 sm:flex-row">
          <Text className="text-ice/70 text-center text-sm">{t(viewingWeekMessageKey)}</Text>
          <Button
            size="sm"
            onPress={onGoToThisWeek}
            className="w-full sm:w-auto"
            testID="week-this-week-button"
          >
            <FontAwesome name="calendar" size={14} color="#F1F5F9" />
            <ButtonText className="ml-1.5">{t('diary.thisWeek')}</ButtonText>
          </Button>
        </Box>
      ) : null}

      <Box className="flex-row flex-nowrap items-center gap-2">
        <Pressable
          onPress={handlePressPreviousWeek}
          disabled={!canGoBack}
          className={`bg-primary shrink-0 rounded-lg px-3 py-2.5 ${!canGoBack ? 'opacity-40' : ''}`}
          testID="week-previous-button"
        >
          <FontAwesome name="chevron-left" size={16} color="#F1F5F9" />
        </Pressable>

        <Pressable
          onPress={() => setWeekPickerVisible(true)}
          className="border-ice/20 bg-surface min-w-0 flex-1 rounded-lg border px-3 py-2.5"
          testID="week-select"
        >
          <Text className="text-ice text-center text-sm" numberOfLines={2}>
            {selectedWeekLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={handlePressNextWeek}
          disabled={!canGoForward}
          className={`bg-primary shrink-0 rounded-lg px-3 py-2.5 ${!canGoForward ? 'opacity-40' : ''}`}
          testID="week-next-button"
        >
          <FontAwesome name="chevron-right" size={16} color="#F1F5F9" />
        </Pressable>
      </Box>

      <DialogModal
        visible={weekPickerVisible}
        onClose={() => setWeekPickerVisible(false)}
        placement="bottom"
      >
        <DialogPanel className="w-full max-h-[70%] rounded-t-2xl bg-surface p-4">
            <Text className="text-ice mb-3 text-center text-base font-semibold">
              {t('diary.weekSelection')}
            </Text>
            <ScrollView>
              {filteredWeeks.map((week) => {
                const weekKey = `${week.year}-${week.number}`;
                const isSelected = weekKey === selectedWeekKey;
                return (
                  <Pressable
                    key={weekKey}
                    onPress={() => handlePressWeekOption(week.year, week.number)}
                    className={`mb-2 rounded-lg px-4 py-3 ${isSelected ? 'bg-primary/20' : 'bg-base'}`}
                    testID={`week-option-${weekKey}`}
                  >
                    <Text className={`text-sm ${isSelected ? 'text-primary' : 'text-ice'}`}>
                      {formatWeekOptionLabel(week, selectedYear, t('diary.week'))}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button variant="outline" onPress={() => setWeekPickerVisible(false)} className="mt-2">
              <ButtonText>{t('common.close')}</ButtonText>
            </Button>
        </DialogPanel>
      </DialogModal>
    </Box>
  );
}
