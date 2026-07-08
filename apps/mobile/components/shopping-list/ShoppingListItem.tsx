import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import type { ShoppingListItem } from '@/types/shoppingList';

const DEPTH_INDENT_PX = 24;
const SWIPE_THRESHOLD = 40;
const SWIPE_MAX_OFFSET = 56;

interface ShoppingListItemRowProps {
  item: ShoppingListItem;
  depth?: number;
  hideCheckbox?: boolean;
  isFocused?: boolean;
  editable?: boolean;
  inputRef?: (ref: TextInput | null) => void;
  onFocus?: () => void;
  onNameChange?: (name: string) => void;
  onBlur?: (name: string) => void;
  onSubmitEditing?: (name: string) => void;
  onCheckedChange?: (itemId: number | string, checked: boolean) => void;
  onIndent?: (itemId: number | string) => void;
  onOutdent?: (itemId: number | string) => void;
  onRemove?: (itemId: number | string) => void;
  isRemoving?: boolean;
  isUpdating?: boolean;
}

export function ShoppingListItemRow({
  item,
  depth = 0,
  hideCheckbox = false,
  isFocused = false,
  editable = false,
  inputRef,
  onFocus,
  onNameChange,
  onBlur,
  onSubmitEditing,
  onCheckedChange,
  onIndent,
  onOutdent,
  onRemove,
  isRemoving = false,
  isUpdating = false,
}: ShoppingListItemRowProps) {
  const { t } = useTranslation();
  const [draftName, setDraftName] = useState(item.name);
  const isDisabled = isRemoving || isUpdating;
  const showInput = editable && isFocused;
  const previousItemIdRef = useRef(item.id);
  const translateX = useSharedValue(0);
  const swipeEnabled = !showInput && !isDisabled && (!!onIndent || !!onOutdent);

  const onIndentRef = useRef(onIndent);
  const onOutdentRef = useRef(onOutdent);
  const onFocusRef = useRef(onFocus);
  onIndentRef.current = onIndent;
  onOutdentRef.current = onOutdent;
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

  const triggerIndent = useCallback(() => {
    onIndentRef.current?.(item.id);
  }, [item.id]);

  const triggerOutdent = useCallback(() => {
    onOutdentRef.current?.(item.id);
  }, [item.id]);

  const triggerFocus = useCallback(() => {
    onFocusRef.current?.();
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(swipeEnabled)
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onUpdate((event) => {
          const clamped = Math.max(
            -SWIPE_MAX_OFFSET,
            Math.min(SWIPE_MAX_OFFSET, event.translationX)
          );
          translateX.value = clamped;
        })
        .onEnd((event) => {
          if (event.translationX >= SWIPE_THRESHOLD) {
            runOnJS(triggerIndent)();
          } else if (event.translationX <= -SWIPE_THRESHOLD) {
            runOnJS(triggerOutdent)();
          }

          translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
        })
        .onFinalize(() => {
          translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
        }),
    [swipeEnabled, translateX, triggerIndent, triggerOutdent]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(editable && !showInput && !isDisabled)
        .onEnd(() => {
          runOnJS(triggerFocus)();
        }),
    [editable, isDisabled, showInput, triggerFocus]
  );

  const rowGesture = useMemo(
    () => (swipeEnabled ? Gesture.Exclusive(panGesture, tapGesture) : tapGesture),
    [panGesture, swipeEnabled, tapGesture]
  );

  const animatedRowStyle = useAnimatedStyle(() => {
    const offset = translateX.value;
    const backgroundColor =
      offset > 16
        ? 'rgba(99, 102, 241, 0.18)'
        : offset < -16
          ? 'rgba(99, 102, 241, 0.1)'
          : 'transparent';

    return {
      transform: [{ translateX: offset }],
      backgroundColor,
    };
  });

  const handleNameChange = (name: string) => {
    setDraftName(name);
    onNameChange?.(name);
  };

  const nameContent = (
    <Text
      className={`text-base text-ice ${item.checked ? 'line-through opacity-50' : ''}`}
    >
      {item.name || (editable ? t('shoppingList.enterItemName') : '')}
    </Text>
  );

  const rowContent = (
    <Animated.View
      className="flex-row items-center gap-2 rounded-lg px-2 py-2"
      style={[{ marginLeft: depth * DEPTH_INDENT_PX }, animatedRowStyle]}
      testID={`shopping-item-row-${item.id}`}
    >
      {!hideCheckbox ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.checked }}
          className={`h-5 w-5 items-center justify-center rounded border ${
            item.checked ? 'border-primary bg-primary' : 'border-white/20'
          }`}
          disabled={isDisabled || !onCheckedChange}
          onPress={() => onCheckedChange?.(item.id, !item.checked)}
          testID={`shopping-item-checkbox-${item.id}`}
        >
          {item.checked ? <FontAwesome name="check" size={10} color="#F1F5F9" /> : null}
        </Pressable>
      ) : null}

      {showInput ? (
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
      ) : editable ? (
        <View className="flex-1" testID={`shopping-item-name-${item.id}`}>
          {nameContent}
        </View>
      ) : (
        <View className="flex-1" testID={`shopping-item-name-${item.id}`}>
          {nameContent}
        </View>
      )}

      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove item"
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
    </Animated.View>
  );

  if (showInput) {
    return rowContent;
  }

  return (
    <GestureDetector gesture={rowGesture}>
      <View>{rowContent}</View>
    </GestureDetector>
  );
}
