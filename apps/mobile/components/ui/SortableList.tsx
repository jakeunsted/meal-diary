import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const LONG_PRESS_MS = 160;

export type SortableActivation = 'immediate' | 'longPress';

export interface SortableDragHandleProps {
  gesture: ComponentProps<typeof GestureDetector>['gesture'];
  isActive: boolean;
}

interface SortableListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  onReorder: (orderedKeys: string[]) => void;
  renderItem: (item: T, dragHandleProps: SortableDragHandleProps) => ReactNode;
  disabled?: boolean;
  onDraggingChange?: (isDragging: boolean) => void;
  activation?: SortableActivation;
  defaultRowHeight?: number;
  testID?: string;
  rowTestIDPrefix?: string;
}

interface SortableRowProps<T> {
  item: T;
  itemKey: string;
  disabled: boolean;
  isActive: boolean;
  activation: SortableActivation;
  defaultRowHeight: number;
  order: SharedValue<string[]>;
  heightsById: SharedValue<Record<string, number>>;
  draggingId: SharedValue<string | null>;
  dragTranslationY: SharedValue<number>;
  dragStartIndex: SharedValue<number>;
  currentIndex: SharedValue<number>;
  onDragBegin: (itemKey: string) => void;
  onDragEnd: () => void;
  renderItem: SortableListProps<T>['renderItem'];
  rowTestIDPrefix: string;
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

function indexOfId(order: string[], id: string) {
  'worklet';
  for (let i = 0; i < order.length; i += 1) {
    if (order[i] === id) {
      return i;
    }
  }
  return -1;
}

function resolveTargetIndex(
  fromIndex: number,
  translationY: number,
  order: string[],
  heightsById: Record<string, number>,
  defaultRowHeight: number
) {
  'worklet';
  const draggedId = order[fromIndex];
  const rowHeight = heightsById[draggedId] ?? defaultRowHeight;
  if (rowHeight <= 0) {
    return fromIndex;
  }

  const delta = Math.round(translationY / rowHeight);
  return clamp(fromIndex + delta, 0, order.length - 1);
}

function rowShiftY(
  itemKey: string,
  order: string[],
  draggingId: string | null,
  dragStartIndex: number,
  currentIndex: number,
  heightsById: Record<string, number>,
  defaultRowHeight: number
) {
  'worklet';
  if (draggingId == null || dragStartIndex < 0 || currentIndex < 0) {
    return 0;
  }
  if (itemKey === draggingId) {
    return 0;
  }

  const itemIndex = indexOfId(order, itemKey);
  if (itemIndex < 0) {
    return 0;
  }

  const draggedHeight = heightsById[draggingId] ?? defaultRowHeight;
  if (dragStartIndex < currentIndex && itemIndex > dragStartIndex && itemIndex <= currentIndex) {
    return -draggedHeight;
  }
  if (dragStartIndex > currentIndex && itemIndex < dragStartIndex && itemIndex >= currentIndex) {
    return draggedHeight;
  }
  return 0;
}

function SortableRow<T>({
  item,
  itemKey,
  disabled,
  isActive,
  activation,
  defaultRowHeight,
  order,
  heightsById,
  draggingId,
  dragTranslationY,
  dragStartIndex,
  currentIndex,
  onDragBegin,
  onDragEnd,
  renderItem,
  rowTestIDPrefix,
}: SortableRowProps<T>) {
  const panGesture = useMemo(() => {
    let pan = Gesture.Pan().enabled(!disabled).maxPointers(1);

    if (activation === 'immediate' || Platform.OS === 'web') {
      pan = pan
        .activeOffsetY([-6, 6])
        .failOffsetX([-24, 24])
        .shouldCancelWhenOutside(false);
    } else {
      pan = pan.activateAfterLongPress(LONG_PRESS_MS).failOffsetX([-20, 20]);
    }

    pan = pan
      .onStart(() => {
        'worklet';
        const from = indexOfId(order.value, itemKey);
        if (from < 0) {
          return;
        }
        draggingId.value = itemKey;
        dragStartIndex.value = from;
        currentIndex.value = from;
        dragTranslationY.value = 0;
        scheduleOnRN(onDragBegin, itemKey);
      })
      .onUpdate((event) => {
        'worklet';
        if (draggingId.value !== itemKey) {
          return;
        }
        dragTranslationY.value = event.translationY;
        currentIndex.value = resolveTargetIndex(
          dragStartIndex.value,
          event.translationY,
          order.value,
          heightsById.value,
          defaultRowHeight
        );
      })
      .onFinalize(() => {
        'worklet';
        if (draggingId.value !== itemKey) {
          return;
        }
        dragTranslationY.value = withSpring(0, { damping: 20, stiffness: 220 });
        scheduleOnRN(onDragEnd);
      });

    return Gesture.Simultaneous(pan, Gesture.Native());
  }, [
    activation,
    currentIndex,
    defaultRowHeight,
    disabled,
    dragStartIndex,
    dragTranslationY,
    draggingId,
    heightsById,
    itemKey,
    onDragBegin,
    onDragEnd,
    order,
  ]);

  const animatedStyle = useAnimatedStyle(() => {
    const isDragging = draggingId.value === itemKey;
    const shift = isDragging
      ? dragTranslationY.value
      : rowShiftY(
          itemKey,
          order.value,
          draggingId.value,
          dragStartIndex.value,
          currentIndex.value,
          heightsById.value,
          defaultRowHeight
        );

    return {
      transform: [{ translateY: shift }],
      zIndex: isDragging ? 20 : 0,
      elevation: isDragging ? 8 : 0,
      opacity: isDragging ? 0.94 : 1,
    };
  });

  const handleLayout = useCallback(
    (height: number) => {
      if (height <= 0) {
        return;
      }
      heightsById.value = {
        ...heightsById.value,
        [itemKey]: height,
      };
    },
    [heightsById, itemKey]
  );

  return (
    <Animated.View
      style={animatedStyle}
      onLayout={(event) => handleLayout(event.nativeEvent.layout.height)}
      testID={`${rowTestIDPrefix}${itemKey}`}
    >
      {renderItem(item, { gesture: panGesture, isActive })}
    </Animated.View>
  );
}

export function SortableList<T>({
  items,
  getKey,
  onReorder,
  renderItem,
  disabled = false,
  onDraggingChange,
  activation = 'immediate',
  defaultRowHeight = 48,
  testID,
  rowTestIDPrefix = 'sortable-row-',
}: SortableListProps<T>) {
  const order = useSharedValue(items.map(getKey));
  const heightsById = useSharedValue<Record<string, number>>({});
  const draggingId = useSharedValue<string | null>(null);
  const dragTranslationY = useSharedValue(0);
  const dragStartIndex = useSharedValue(-1);
  const currentIndex = useSharedValue(-1);
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null);

  useEffect(() => {
    order.value = items.map(getKey);
  }, [getKey, items, order]);

  const handleDragBegin = useCallback(
    (itemKey: string) => {
      setActiveItemKey(itemKey);
      onDraggingChange?.(true);
    },
    [onDraggingChange]
  );

  const handleDragEnd = useCallback(() => {
    const from = dragStartIndex.value;
    const to = currentIndex.value;
    const keys = [...order.value];

    draggingId.value = null;
    dragStartIndex.value = -1;
    currentIndex.value = -1;
    dragTranslationY.value = 0;
    setActiveItemKey(null);
    onDraggingChange?.(false);

    if (from < 0 || to < 0 || from === to || from >= keys.length || to >= keys.length) {
      return;
    }

    const nextKeys = [...keys];
    const [moved] = nextKeys.splice(from, 1);
    nextKeys.splice(to, 0, moved);
    order.value = nextKeys;
    onReorder(nextKeys);
  }, [
    currentIndex,
    dragStartIndex,
    dragTranslationY,
    draggingId,
    onDraggingChange,
    onReorder,
    order,
  ]);

  if (items.length === 0) {
    return null;
  }

  return (
    <View testID={testID}>
      {items.map((item) => {
        const itemKey = getKey(item);
        return (
          <SortableRow
            key={itemKey}
            item={item}
            itemKey={itemKey}
            disabled={disabled}
            isActive={activeItemKey === itemKey}
            activation={activation}
            defaultRowHeight={defaultRowHeight}
            order={order}
            heightsById={heightsById}
            draggingId={draggingId}
            dragTranslationY={dragTranslationY}
            dragStartIndex={dragStartIndex}
            currentIndex={currentIndex}
            onDragBegin={handleDragBegin}
            onDragEnd={handleDragEnd}
            renderItem={renderItem}
            rowTestIDPrefix={rowTestIDPrefix}
          />
        );
      })}
    </View>
  );
}
