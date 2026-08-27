import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
} from '@meal-diary/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { ShoppingListDragHandleProps } from '@/components/shopping-list/ShoppingListSortableList';
import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Text } from '@/components/ui/text';
import type { ShoppingListItem } from '@/types/shoppingList';

interface ShoppingListItemRowProps {
  item: ShoppingListItem;
  hideCheckbox?: boolean;
  isFocused?: boolean;
  editable?: boolean;
  inputRef?: (ref: TextInput | null) => void;
  onFocus?: () => void;
  onNameChange?: (name: string) => void;
  onBlur?: (name: string) => void;
  onSubmitEditing?: (name: string) => void;
  onCheckedChange?: (itemId: number | string, checked: boolean) => void;
  onMoveCategory?: (itemId: number | string, category: ShoppingCategory) => void;
  onRemove?: (itemId: number | string) => void;
  isRemoving?: boolean;
  isUpdating?: boolean;
  dragHandleProps?: ShoppingListDragHandleProps;
}

function categoryLabelKey(category: ShoppingCategory): string {
  switch (category) {
    case 'meat':
      return 'shoppingList.meat';
    case 'fruit_veg':
      return 'shoppingList.fruitVeg';
    case 'bakery':
      return 'shoppingList.bakery';
    case 'canned':
      return 'shoppingList.canned';
    case 'other':
      return 'shoppingList.other';
    default:
      return 'shoppingList.other';
  }
}

export function ShoppingListItemRow({
  item,
  hideCheckbox = false,
  isFocused = false,
  editable = false,
  inputRef,
  onFocus,
  onNameChange,
  onBlur,
  onSubmitEditing,
  onCheckedChange,
  onMoveCategory,
  onRemove,
  isRemoving = false,
  isUpdating = false,
  dragHandleProps,
}: ShoppingListItemRowProps) {
  const { t } = useTranslation();
  const [draftName, setDraftName] = useState(item.name);
  const [moveSheetVisible, setMoveSheetVisible] = useState(false);
  const isDisabled = isRemoving || isUpdating;
  const showInput = editable && isFocused;
  const previousItemIdRef = useRef(item.id);
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  useEffect(() => {
    if (previousItemIdRef.current !== item.id) {
      previousItemIdRef.current = item.id;
      setDraftName(item.name);
      return;
    }

    if (!isFocused) {
      setDraftName(item.name);
    }
  }, [isFocused, item.id, item.name]);

  const triggerFocus = useCallback(() => {
    onFocusRef.current?.();
  }, []);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(editable && !showInput && !isDisabled)
        .onEnd(() => {
          runOnJS(triggerFocus)();
        }),
    [editable, isDisabled, showInput, triggerFocus]
  );

  const handleNameChange = (name: string) => {
    setDraftName(name);
    onNameChange?.(name);
  };

  const handleOpenMoveSheet = () => {
    if (isDisabled || !onMoveCategory) {
      return;
    }
    setMoveSheetVisible(true);
  };

  const handleCloseMoveSheet = () => {
    setMoveSheetVisible(false);
  };

  const handleSelectCategory = (category: ShoppingCategory) => {
    setMoveSheetVisible(false);
    if (category === item.category) {
      return;
    }
    onMoveCategory?.(item.id, category);
  };

  const nameContent = (
    <Text
      className={`text-base text-ice ${item.checked ? 'line-through opacity-50' : ''}`}
    >
      {item.name || (editable ? t('shoppingList.enterItemName') : '')}
    </Text>
  );

  const nameArea = showInput ? (
    <TextInput
      ref={inputRef}
      className={`flex-1 px-2 py-1 text-base text-ice ${item.checked ? 'line-through opacity-50' : ''}`}
      placeholder={t('shoppingList.enterItemName')}
      placeholderTextColor="rgba(241, 245, 249, 0.4)"
      value={draftName}
      onChangeText={handleNameChange}
      onFocus={onFocus}
      onBlur={() => onBlur?.(draftName)}
      onSubmitEditing={() => onSubmitEditing?.(draftName)}
      blurOnSubmit={false}
      returnKeyType="next"
      autoFocus
      testID={`shopping-item-edit-input-${item.id}`}
    />
  ) : (
    <View className="justify-center py-1" testID={`shopping-item-name-${item.id}`}>
      {nameContent}
    </View>
  );

  return (
    <View
      className="flex-row items-center gap-2 rounded-lg px-2 py-2"
      testID={`shopping-item-row-${item.id}`}
    >
      {dragHandleProps ? (
        <GestureDetector gesture={dragHandleProps.gesture}>
          <View
            accessibilityRole="button"
            accessibilityLabel={t('shoppingList.reorderItem')}
            className="h-8 w-7 items-center justify-center"
            collapsable={false}
            testID={`shopping-item-drag-handle-${item.id}`}
          >
            <FontAwesome
              name="bars"
              size={12}
              color={dragHandleProps.isActive ? '#6366F1' : 'rgba(241, 245, 249, 0.45)'}
            />
          </View>
        </GestureDetector>
      ) : null}

      {!hideCheckbox ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.checked }}
          className="h-9 w-9 items-center justify-center"
          disabled={isDisabled || !onCheckedChange}
          onPress={() => onCheckedChange?.(item.id, !item.checked)}
          testID={`shopping-item-checkbox-${item.id}`}
        >
          <View
            className={`h-5 w-5 items-center justify-center rounded border ${
              item.checked ? 'border-primary bg-primary' : 'border-white/20'
            }`}
          >
            {item.checked ? <FontAwesome name="check" size={10} color="#F1F5F9" /> : null}
          </View>
        </Pressable>
      ) : null}

      {showInput ? (
        nameArea
      ) : (
        <GestureDetector gesture={tapGesture}>
          <View className="min-w-0 flex-1">{nameArea}</View>
        </GestureDetector>
      )}

      {onMoveCategory && !item.checked ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('shoppingList.moveToCategory')}
          className="h-8 w-8 items-center justify-center rounded-lg"
          disabled={isDisabled}
          onPress={handleOpenMoveSheet}
          testID={`shopping-item-move-${item.id}`}
        >
          <FontAwesome name="folder-o" size={14} color="rgba(241, 245, 249, 0.7)" />
        </Pressable>
      ) : null}

      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('shoppingList.removeItem')}
          className="h-8 w-8 items-center justify-center rounded-lg"
          disabled={isDisabled}
          onPress={() => onRemove(item.id)}
          testID={`shopping-item-remove-${item.id}`}
        >
          {isRemoving ? (
            <ActivityIndicator size="small" color="#F1F5F9" />
          ) : (
            <FontAwesome name="times" size={14} color="rgba(241, 245, 249, 0.7)" />
          )}
        </Pressable>
      ) : null}

      <DialogModal
        visible={moveSheetVisible}
        onClose={handleCloseMoveSheet}
        placement="bottom"
        testID={`shopping-item-move-sheet-${item.id}`}
      >
        <DialogPanel className="mb-6 w-full">
          <Text className="mb-3 text-base font-semibold text-ice">
            {t('shoppingList.moveToCategory')}
          </Text>
          {SHOPPING_CATEGORIES.map((category) => {
            const isCurrent = category === item.category;
            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                className={`mb-1 rounded-xl px-3 py-3 ${isCurrent ? 'bg-primary/20' : 'bg-ice/5'}`}
                onPress={() => handleSelectCategory(category)}
                testID={`shopping-item-move-${item.id}-${category}`}
              >
                <Text className={`text-base ${isCurrent ? 'text-primary font-semibold' : 'text-ice'}`}>
                  {t(categoryLabelKey(category))}
                </Text>
              </Pressable>
            );
          })}
        </DialogPanel>
      </DialogModal>
    </View>
  );
}
