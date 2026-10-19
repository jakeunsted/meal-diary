import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';

export interface DiarySyncReviewRow {
  dayOfWeek: number;
  mealSlotId: number;
  dayLabel: string;
  slotName: string;
  yoursLabel: string;
  theirsLabel: string;
}

interface DiarySyncReviewModalProps {
  visible: boolean;
  rows: DiarySyncReviewRow[];
  isResolving?: boolean;
  onKeepMine: (dayOfWeek: number, mealSlotId: number) => void;
  onKeepTheirs: (dayOfWeek: number, mealSlotId: number) => void;
  onKeepAllMine: () => void;
  onKeepAllTheirs: () => void;
  onDismiss: () => void;
}

export function DiarySyncReviewModal({
  visible,
  rows,
  isResolving = false,
  onKeepMine,
  onKeepTheirs,
  onKeepAllMine,
  onKeepAllTheirs,
  onDismiss,
}: DiarySyncReviewModalProps) {
  const { t } = useTranslation();

  const run = (action: () => void) => {
    if (!isResolving) {
      action();
    }
  };

  const handleReviewDismiss = () => run(onDismiss);
  const handleKeepMine = (dayOfWeek: number, mealSlotId: number) =>
    run(() => onKeepMine(dayOfWeek, mealSlotId));
  const handleKeepTheirs = (dayOfWeek: number, mealSlotId: number) =>
    run(() => onKeepTheirs(dayOfWeek, mealSlotId));
  const handleKeepAllMine = () => run(onKeepAllMine);
  const handleKeepAllTheirs = () => run(onKeepAllTheirs);

  return (
    <DialogModal
      visible={visible}
      onClose={handleReviewDismiss}
      testID="diary-sync-review-modal"
    >
      <DialogPanel className="max-h-[85%] w-full">
        <Heading size="lg" className="text-ice mb-2">
          {t('diarySync.title')}
        </Heading>
        <Text className="text-ice/70 mb-4 text-sm">{t('diarySync.body')}</Text>

        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          {rows.map((row) => (
            <Box
              key={`${row.dayOfWeek}-${row.mealSlotId}`}
              className="mb-3 rounded-xl bg-base px-4 py-3"
              testID={`diary-sync-row-${row.dayOfWeek}-${row.mealSlotId}`}
            >
              <Text className="text-ice font-semibold">{row.dayLabel}</Text>
              {row.slotName ? (
                <Text className="text-ice/70 mb-2 text-sm">{row.slotName}</Text>
              ) : null}
              <Text className="text-ice text-sm">
                {t('diarySync.yours')}: {row.yoursLabel}
              </Text>
              <Text className="text-ice mb-3 text-sm">
                {t('diarySync.theirs')}: {row.theirsLabel}
              </Text>
              <Box className="flex-row flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={isResolving}
                  onPress={() => handleKeepMine(row.dayOfWeek, row.mealSlotId)}
                  testID={`diary-sync-keep-mine-${row.mealSlotId}`}
                >
                  <ButtonText>{t('diarySync.keepMine')}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isResolving}
                  onPress={() => handleKeepTheirs(row.dayOfWeek, row.mealSlotId)}
                  testID={`diary-sync-keep-theirs-${row.mealSlotId}`}
                >
                  <ButtonText>{t('diarySync.keepTheirs')}</ButtonText>
                </Button>
              </Box>
            </Box>
          ))}
        </ScrollView>

        <Box className="mt-4 gap-2">
          <Button
            size="sm"
            disabled={isResolving || rows.length === 0}
            onPress={handleKeepAllMine}
            testID="diary-sync-keep-all-mine"
          >
            {isResolving ? <ButtonSpinner color="#6366F1" /> : null}
            <ButtonText>{t('diarySync.keepAllMine')}</ButtonText>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isResolving || rows.length === 0}
            onPress={handleKeepAllTheirs}
            testID="diary-sync-keep-all-theirs"
          >
            <ButtonText>{t('diarySync.keepAllTheirs')}</ButtonText>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isResolving}
            onPress={handleReviewDismiss}
            testID="diary-sync-close"
          >
            <ButtonText>{t('diarySync.close')}</ButtonText>
          </Button>
        </Box>
      </DialogPanel>
    </DialogModal>
  );
}
