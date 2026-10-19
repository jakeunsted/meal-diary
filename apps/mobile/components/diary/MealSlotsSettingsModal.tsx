import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  MAX_MEAL_SLOT_NAME_LENGTH,
  MAX_MEAL_SLOTS,
  MEAL_SLOT_QUICK_ADD_PRESETS,
  MIN_MEAL_SLOTS,
  diffMealSlots,
  validateMealSlotNames,
} from '@meal-diary/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInput as TextInputType,
} from 'react-native';
import { GestureDetector, ScrollView } from 'react-native-gesture-handler';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

import {
  MealSlotsSortableList,
  type MealSlotsDragHandleProps,
} from '@/components/diary/MealSlotsSortableList';
import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { captureEvent, captureException, logError, logInfo } from '@/lib/analytics/posthog';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { useUpdateMealSlots } from '@/lib/queries/mealSlots';
import type { MealSlotTemplate } from '@/types/mealDiary';

interface DraftSlot {
  clientKey: string;
  id: number | null;
  name: string;
}

interface MealSlotsSettingsModalProps {
  visible: boolean;
  familyGroupId: number | undefined;
  canCustomize: boolean;
  initialSlots: MealSlotTemplate[];
  onClose: () => void;
  onSaved: () => void;
}

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let clientKeyCounter = 0;
const nextClientKey = () => {
  clientKeyCounter += 1;
  return `slot-${clientKeyCounter}`;
};

function slotsSignature(slots: Array<{ id: number | null; name: string }>): string {
  return slots.map((slot) => `${slot.id ?? 'new'}:${slot.name.trim()}`).join('|');
}

export function MealSlotsSettingsModal({
  visible,
  familyGroupId,
  canCustomize,
  initialSlots,
  onClose,
  onSaved,
}: MealSlotsSettingsModalProps) {
  const { t } = useTranslation();
  const openPaywall = usePaywallStore((state) => state.openPaywall);
  const updateMutation = useUpdateMealSlots(familyGroupId);

  const [draftSlots, setDraftSlots] = useState<DraftSlot[]>([]);
  const [baselineSignature, setBaselineSignature] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [removalImpact, setRemovalImpact] = useState<
    Array<{ id: number | string; name: string; futureMealsWithContent: number }>
  >([]);
  const [confirm, setConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusClientKey, setFocusClientKey] = useState<string | null>(null);

  const inputRefs = useRef<Record<string, TextInputType | null>>({});

  useEffect(() => {
    if (!visible) return;
    const source =
      initialSlots.length > 0
        ? initialSlots
        : [
            { id: null as number | null, name: 'Breakfast' },
            { id: null, name: 'Lunch' },
            { id: null, name: 'Dinner' },
          ];
    const nextDraft = source.map((slot) => ({
      clientKey: nextClientKey(),
      id: slot.id ?? null,
      name: slot.name,
    }));
    setDraftSlots(nextDraft);
    setBaselineSignature(slotsSignature(nextDraft));
    setRemovalImpact([]);
    setConfirm(false);
    setErrorMessage(null);
    setIsDragging(false);
    setFocusClientKey(null);
  }, [visible, initialSlots]);

  useEffect(() => {
    if (!focusClientKey) return;
    const input = inputRefs.current[focusClientKey];
    if (!input) return;
    const timer = setTimeout(() => {
      input.focus();
      setFocusClientKey(null);
    }, 50);
    return () => clearTimeout(timer);
  }, [focusClientKey, draftSlots]);

  const isDirty = useMemo(
    () => slotsSignature(draftSlots) !== baselineSignature,
    [baselineSignature, draftSlots]
  );

  const validationError = useMemo(() => {
    const result = validateMealSlotNames(draftSlots);
    if (result.ok) return null;
    const first = result.errors[0];
    if (!first) return t('diarySettings.invalidCount');
    if (first.code === 'duplicate') return t('diarySettings.duplicateName');
    if (first.code === 'emoji') return t('diarySettings.noEmoji');
    if (first.code === 'too_long') return t('diarySettings.nameTooLong');
    if (first.code === 'empty') return t('diarySettings.nameRequired');
    return t('diarySettings.invalidName');
  }, [draftSlots, t]);

  const removalWarning = useMemo(() => {
    if (!removalImpact.length) return null;
    const withContent = removalImpact.filter((r) => r.futureMealsWithContent > 0);
    if (withContent.length) {
      return withContent
        .map((r) =>
          t('diarySettings.removeWithContent', {
            name: r.name,
            count: r.futureMealsWithContent,
          })
        )
        .join(' ');
    }
    return t('diarySettings.removeEmpty');
  }, [removalImpact, t]);

  const handleRequestClose = useCallback(() => {
    Keyboard.dismiss();
    if (!canCustomize || !isDirty) {
      onClose();
      return;
    }
    Alert.alert(t('diarySettings.discardTitle'), t('diarySettings.discardMessage'), [
      { text: t('diarySettings.keepEditing'), style: 'cancel' },
      {
        text: t('diarySettings.discard'),
        style: 'destructive',
        onPress: onClose,
      },
    ]);
  }, [canCustomize, isDirty, onClose, t]);

  const handleNameChange = (clientKey: string, name: string) => {
    setDraftSlots((current) =>
      current.map((slot) => (slot.clientKey === clientKey ? { ...slot, name } : slot))
    );
    setConfirm(false);
  };

  const handleAdd = () => {
    if (draftSlots.length >= MAX_MEAL_SLOTS) return;
    const clientKey = nextClientKey();
    setDraftSlots((current) => [...current, { clientKey, id: null, name: '' }]);
    setFocusClientKey(clientKey);
  };

  const handleRemove = (clientKey: string) => {
    if (draftSlots.length <= MIN_MEAL_SLOTS) return;
    setDraftSlots((current) => current.filter((slot) => slot.clientKey !== clientKey));
    setConfirm(false);
  };

  const handleApplyPreset = (preset: string) => {
    setDraftSlots((current) => {
      const emptyIndex = current.findIndex((slot) => !slot.name.trim());
      if (emptyIndex >= 0) {
        return current.map((slot, i) =>
          i === emptyIndex ? { ...slot, name: preset } : slot
        );
      }
      if (current.length >= MAX_MEAL_SLOTS) return current;
      return [...current, { clientKey: nextClientKey(), id: null, name: preset }];
    });
  };

  const handleReorder = useCallback((orderedKeys: string[]) => {
    setDraftSlots((current) => {
      const byKey = new Map(current.map((slot) => [slot.clientKey, slot]));
      return orderedKeys.map((key) => byKey.get(key)).filter(Boolean) as DraftSlot[];
    });
    setConfirm(false);
  }, []);

  const handleMove = useCallback((clientKey: string, direction: -1 | 1) => {
    setDraftSlots((current) => {
      const index = current.findIndex((slot) => slot.clientKey === clientKey);
      if (index < 0) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
    setConfirm(false);
  }, []);

  const handleViewPlans = () => {
    onClose();
    openPaywall('custom_meal_slots');
  };

  useEffect(() => {
    if (confirm) return;
    const diff = diffMealSlots(
      initialSlots.map((s) => ({ id: s.id, name: s.name })),
      draftSlots.map((s) => ({ id: s.id, name: s.name }))
    );
    if (diff.removed.length && !diff.requiresConfirmation) {
      setRemovalImpact(
        diff.removed.map((r) => ({
          ...r,
          futureMealsWithContent: 0,
        }))
      );
    } else if (!diff.removed.length) {
      setRemovalImpact([]);
    }
  }, [confirm, draftSlots, initialSlots]);

  const handleSave = async () => {
    if (!canCustomize || !familyGroupId || validationError) return;

    try {
      logInfo('meal_slots_save_started', {
        family_group_id: familyGroupId,
        slot_count: draftSlots.length,
      });
      await updateMutation.mutateAsync({
        slots: draftSlots.map((slot) => ({ id: slot.id, name: slot.name })),
        today: localToday(),
        confirm,
      });
      captureEvent('diary_meal_slots_saved', { slot_count: draftSlots.length });
      logInfo('meal_slots_save_succeeded', {
        family_group_id: familyGroupId,
        slot_count: draftSlots.length,
      });
      onSaved();
      onClose();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === 'MEAL_SLOTS_CONFIRMATION_REQUIRED'
      ) {
        setRemovalImpact(error.data?.removed ?? []);
        setConfirm(true);
        return;
      }
      logError('meal_slots_save_failed', {
        family_group_id: familyGroupId,
      });
      captureException(error, { category: 'diary' });
      setErrorMessage(t('diarySettings.saveFailed'));
    }
  };

  const atMaxSlots = draftSlots.length >= MAX_MEAL_SLOTS;
  const displayName = (slot: DraftSlot, index: number) =>
    slot.name.trim() || t('diarySettings.mealNameLabelIndexed', { index: index + 1 });

  const renderSlotRow = useCallback(
    (slot: DraftSlot, dragHandleProps: MealSlotsDragHandleProps) => {
      const index = draftSlots.findIndex((item) => item.clientKey === slot.clientKey);
      const canRemove = draftSlots.length > MIN_MEAL_SLOTS;
      const canMoveUp = index > 0;
      const canMoveDown = index >= 0 && index < draftSlots.length - 1;
      const nameForA11y = displayName(slot, index);

      return (
        <View style={styles.slotRow} testID={`meal-slot-row-${index}`}>
          <GestureDetector gesture={dragHandleProps.gesture}>
            <View
              accessibilityRole="button"
              accessibilityLabel={t('diarySettings.reorder')}
              accessibilityHint={t('diarySettings.reorderHint')}
              style={styles.slotIconButton}
              collapsable={false}
              testID={`meal-slot-drag-handle-${index}`}
            >
              <FontAwesome
                name="bars"
                size={12}
                color={dragHandleProps.isActive ? '#6366F1' : 'rgba(241, 245, 249, 0.45)'}
              />
            </View>
          </GestureDetector>

          <TextInput
            ref={(ref) => {
              inputRefs.current[slot.clientKey] = ref;
            }}
            style={styles.slotNameInput}
            value={slot.name}
            onChangeText={(name) => handleNameChange(slot.clientKey, name)}
            maxLength={MAX_MEAL_SLOT_NAME_LENGTH}
            placeholder={t('diarySettings.mealNameLabel')}
            placeholderTextColor="rgba(241, 245, 249, 0.4)"
            accessibilityLabel={t('diarySettings.mealNameLabelIndexed', {
              index: index + 1,
            })}
            underlineColorAndroid="transparent"
            testID={`meal-slot-name-input-${index}`}
          />

          <Pressable
            onPress={() => handleMove(slot.clientKey, -1)}
            disabled={!canMoveUp}
            accessibilityRole="button"
            accessibilityLabel={t('diarySettings.moveUp', { name: nameForA11y })}
            accessibilityState={{ disabled: !canMoveUp }}
            style={styles.slotMoveButton}
            testID={`meal-slot-move-up-${index}`}
          >
            <FontAwesome
              name="chevron-up"
              size={11}
              color={canMoveUp ? 'rgba(241, 245, 249, 0.7)' : 'rgba(241, 245, 249, 0.2)'}
            />
          </Pressable>

          <Pressable
            onPress={() => handleMove(slot.clientKey, 1)}
            disabled={!canMoveDown}
            accessibilityRole="button"
            accessibilityLabel={t('diarySettings.moveDown', { name: nameForA11y })}
            accessibilityState={{ disabled: !canMoveDown }}
            style={styles.slotMoveButton}
            testID={`meal-slot-move-down-${index}`}
          >
            <FontAwesome
              name="chevron-down"
              size={11}
              color={canMoveDown ? 'rgba(241, 245, 249, 0.7)' : 'rgba(241, 245, 249, 0.2)'}
            />
          </Pressable>

          <Pressable
            onPress={() => handleRemove(slot.clientKey)}
            disabled={!canRemove}
            accessibilityRole="button"
            accessibilityLabel={t('diarySettings.removeMeal', { name: nameForA11y })}
            accessibilityState={{ disabled: !canRemove }}
            style={styles.slotIconButton}
            testID={`meal-slot-remove-${index}`}
          >
            <FontAwesome
              name="trash"
              size={12}
              color={canRemove ? '#F87171' : 'rgba(241, 245, 249, 0.25)'}
            />
          </Pressable>
        </View>
      );
    },
    [draftSlots, handleMove, t]
  );

  return (
    <DialogModal
      visible={visible}
      onClose={handleRequestClose}
      placement="center"
      testID="meal-slots-settings-modal"
      backdropAccessibilityLabel={t('diarySettings.dismiss')}
    >
      <DialogPanel className="max-h-[85%] w-full max-w-md">
        <View className="max-h-full">
          <Heading size="md" className="text-ice" testID="meal-slots-settings-title">
            {t('diarySettings.title')}
          </Heading>
          <Text className="text-ice/70 mb-4 text-xs leading-4">
            {canCustomize ? t('diarySettings.subtitle') : t('diarySettings.lockedBody')}
          </Text>

          {!canCustomize ? (
            <>
              <View className="mt-3" testID="meal-slots-list">
                {draftSlots.map((slot, index) => (
                  <View
                    key={slot.clientKey}
                    style={styles.lockedSlotRow}
                    testID={`meal-slot-row-${index}`}
                  >
                    <Text className="text-ice text-sm leading-5">
                      {slot.name.trim() || t('diarySettings.mealNameLabelIndexed', { index: index + 1 })}
                    </Text>
                  </View>
                ))}
              </View>

              <Box className="mt-5 gap-3">
                <Button
                  onPress={handleViewPlans}
                  testID="meal-slots-view-plans"
                  accessibilityRole="button"
                  accessibilityLabel={t('diarySettings.viewPlans')}
                >
                  <ButtonText>{t('diarySettings.viewPlans')}</ButtonText>
                </Button>
                <Pressable
                  onPress={handleRequestClose}
                  testID="meal-slots-cancel"
                  accessibilityRole="button"
                  accessibilityLabel={t('diarySettings.cancel')}
                  className="items-center py-2"
                >
                  <Text className="text-ice/80 text-base font-medium">
                    {t('diarySettings.cancel')}
                  </Text>
                </Pressable>
              </Box>
            </>
          ) : (
            <>
              <KeyboardAwareScrollView
                className="mt-3"
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                bottomOffset={24}
                ScrollViewComponent={
                  ScrollView as unknown as KeyboardAwareScrollViewProps['ScrollViewComponent']
                }
                scrollEnabled={!isDragging}
                testID="meal-slots-list"
              >
                <MealSlotsSortableList
                  items={draftSlots}
                  disabled={false}
                  onReorder={handleReorder}
                  onDraggingChange={setIsDragging}
                  renderItem={renderSlotRow}
                />

                <Text className="text-ice/50 mt-3 text-xs font-semibold uppercase tracking-wide">
                  {t('diarySettings.quickAdd')}
                </Text>
                <View className="mt-2 flex-row flex-wrap gap-1.5" testID="meal-slot-presets">
                  {MEAL_SLOT_QUICK_ADD_PRESETS.map((preset) => (
                    <Pressable
                      key={preset}
                      className={`rounded-md border border-ice/30 px-2.5 py-1.5 ${
                        atMaxSlots ? 'opacity-40' : ''
                      }`}
                      onPress={() => handleApplyPreset(preset)}
                      disabled={atMaxSlots}
                      accessibilityRole="button"
                      accessibilityLabel={`+ ${preset}`}
                      accessibilityState={{ disabled: atMaxSlots }}
                      testID={`meal-slot-preset-${preset}`}
                    >
                      <Text className="text-ice text-xs">+ {preset}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    className={`rounded-md px-2.5 py-1.5 ${atMaxSlots ? 'opacity-40' : ''}`}
                    onPress={handleAdd}
                    disabled={atMaxSlots}
                    accessibilityRole="button"
                    accessibilityLabel={t('diarySettings.addMeal')}
                    accessibilityState={{ disabled: atMaxSlots }}
                    testID="meal-slot-add-button"
                  >
                    <Text className="text-primary text-xs font-medium">
                      + {t('diarySettings.customMeal')}
                    </Text>
                  </Pressable>
                </View>

                {validationError ? (
                  <Text
                    className="text-amber-300 mt-3 text-sm"
                    accessibilityLiveRegion="polite"
                    testID="meal-slots-validation-error"
                  >
                    {validationError}
                  </Text>
                ) : null}
                {removalWarning ? (
                  <Text
                    className="text-amber-300 mt-3 text-sm"
                    accessibilityLiveRegion="polite"
                    testID="meal-slots-removal-warning"
                  >
                    {removalWarning}
                  </Text>
                ) : null}
                {errorMessage ? (
                  <Text
                    className="text-red-400 mt-3 text-sm"
                    accessibilityLiveRegion="assertive"
                    accessibilityRole="alert"
                  >
                    {errorMessage}
                  </Text>
                ) : null}
              </KeyboardAwareScrollView>

              <View
                className="mt-2.5 flex-row items-start gap-2 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2"
                testID="meal-slots-apply-from-today"
              >
                <FontAwesome
                  name="info-circle"
                  size={13}
                  color="#818CF8"
                  style={{ marginTop: 1 }}
                />
                <Text className="text-ice/80 flex-1 text-xs leading-4">
                  {t('diarySettings.applyFromToday')}
                </Text>
              </View>

              <Box className="mt-3 flex-row items-center justify-between gap-3">
                <Pressable
                  onPress={handleRequestClose}
                  testID="meal-slots-cancel"
                  accessibilityRole="button"
                  accessibilityLabel={t('diarySettings.cancel')}
                  className="px-1 py-2"
                >
                  <Text className="text-ice/80 text-base font-medium">
                    {t('diarySettings.cancel')}
                  </Text>
                </Pressable>
                <Button
                  className="min-w-28 flex-1"
                  onPress={() => void handleSave()}
                  disabled={Boolean(validationError) || updateMutation.isPending}
                  accessibilityState={{
                    disabled: Boolean(validationError) || updateMutation.isPending,
                  }}
                  testID="meal-slots-save"
                >
                  {updateMutation.isPending ? <ButtonSpinner color="#F1F5F9" /> : null}
                  <ButtonText>{t('diarySettings.save')}</ButtonText>
                </Button>
              </Box>
            </>
          )}
        </View>
      </DialogPanel>
    </DialogModal>
  );
}

const styles = StyleSheet.create({
  scrollArea: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 2,
    paddingRight: 10,
  },
  slotRow: {
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(241, 245, 249, 0.15)',
    backgroundColor: colors.base,
    paddingHorizontal: 2,
    paddingVertical: 1,
    minHeight: 34,
  },
  lockedSlotRow: {
    marginBottom: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(241, 245, 249, 0.15)',
    backgroundColor: colors.base,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  slotIconButton: {
    height: 30,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotMoveButton: {
    height: 30,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Explicit sizes — Android TextInput ignores Tailwind height/padding.
  slotNameInput: {
    flex: 1,
    height: 30,
    paddingVertical: 0,
    paddingHorizontal: 4,
    fontSize: 14,
    lineHeight: 18,
    color: colors.ice,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
