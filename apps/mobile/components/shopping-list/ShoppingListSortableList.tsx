import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import type { ShoppingListItem } from '@/types/shoppingList';

const DEFAULT_ROW_HEIGHT = 48;
const LONG_PRESS_MS = 160;

export interface ShoppingListDragHandleProps {
  gesture: ComponentProps<typeof GestureDetector>['gesture'];
  isActive: boolean;
}

interface ShoppingListSortableListProps {
  items: ShoppingListItem[];
  onReorder: (orderedIds: Array<number | string>) => void;
  renderItem: (
    item: ShoppingListItem,
    dragHandleProps: ShoppingListDragHandleProps
  ) => ReactNode;
  disabled?: boolean;
  onDraggingChange?: (isDragging: boolean) => void;
}

interface SortableRowProps {
  item: ShoppingListItem;
  itemKey: string;
  disabled: boolean;
  isActive: boolean;
  order: SharedValue<string[]>;
  heightsById: SharedValue<Record<string, number>>;
  draggingId: SharedValue<string | null>;
  dragTranslationY: SharedValue<number>;
  dragStartIndex: SharedValue<number>;
  currentIndex: SharedValue<number>;
  onDragBegin: (itemKey: string) => void;
  onDragEnd: () => void;
  renderItem: ShoppingListSortableListProps['renderItem'];
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
  heightsById: Record<string, number>
) {
  'worklet';
  const draggedId = order[fromIndex];
  const rowHeight = heightsById[draggedId] ?? DEFAULT_ROW_HEIGHT;
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
  heightsById: Record<string, number>
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

  const draggedHeight = heightsById[draggingId] ?? DEFAULT_ROW_HEIGHT;
  if (dragStartIndex < currentIndex && itemIndex > dragStartIndex && itemIndex <= currentIndex) {
    return -draggedHeight;
  }
  if (dragStartIndex > currentIndex && itemIndex < dragStartIndex && itemIndex >= currentIndex) {
    return draggedHeight;
  }
  return 0;
}

function SortableRow({
  item,
  itemKey,
  disabled,
  isActive,
  order,
  heightsById,
  draggingId,
  dragTranslationY,
  dragStartIndex,
  currentIndex,
  onDragBegin,
  onDragEnd,
  renderItem,
}: SortableRowProps) {
  const panGesture = useMemo(() => {
    let pan = Gesture.Pan().enabled(!disabled).maxPointers(1);

    if (Platform.OS === 'web') {
      pan = pan.activeOffsetY([-4, 4]).failOffsetX([-16, 16]);
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
        runOnJS(onDragBegin)(itemKey);
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
          heightsById.value
        );
      })
      .onFinalize(() => {
        'worklet';
        if (draggingId.value !== itemKey) {
          return;
        }
        dragTranslationY.value = withSpring(0, { damping: 20, stiffness: 220 });
        runOnJS(onDragEnd)();
      });

    // Keep parent RNGH ScrollView responsive until this pan activates.
    return Gesture.Simultaneous(pan, Gesture.Native());
  }, [
    currentIndex,
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
          heightsById.value
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
      testID={`shopping-list-sortable-row-${item.id}`}
    >
      {renderItem(item, { gesture: panGesture, isActive })}
    </Animated.View>
  );
}

export function ShoppingListSortableList({
  items,
  onReorder,
  renderItem,
  disabled = false,
  onDraggingChange,
}: ShoppingListSortableListProps) {
  const order = useSharedValue(items.map((item) => String(item.id)));
  const heightsById = useSharedValue<Record<string, number>>({});
  const draggingId = useSharedValue<string | null>(null);
  const dragTranslationY = useSharedValue(0);
  const dragStartIndex = useSharedValue(-1);
  const currentIndex = useSharedValue(-1);
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null);

  const idByKey = useMemo(() => {
    const map = new Map<string, number | string>();
    for (const item of items) {
      map.set(String(item.id), item.id);
    }
    return map;
  }, [items]);

  useEffect(() => {
    order.value = items.map((item) => String(item.id));
  }, [items, order]);

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

    const orderedIds = nextKeys.map((key) => idByKey.get(key) ?? key);
    onReorder(orderedIds);
  }, [
    currentIndex,
    dragStartIndex,
    dragTranslationY,
    draggingId,
    idByKey,
    onDraggingChange,
    onReorder,
    order,
  ]);

  if (items.length === 0) {
    return null;
  }

  return (
    <View testID="shopping-list-active-items">
      {items.map((item) => {
        const itemKey = String(item.id);
        return (
          <SortableRow
            key={itemKey}
            item={item}
            itemKey={itemKey}
            disabled={disabled}
            isActive={activeItemKey === itemKey}
            order={order}
            heightsById={heightsById}
            draggingId={draggingId}
            dragTranslationY={dragTranslationY}
            dragStartIndex={dragStartIndex}
            currentIndex={currentIndex}
            onDragBegin={handleDragBegin}
            onDragEnd={handleDragEnd}
            renderItem={renderItem}
          />
        );
      })}
    </View>
  );
}
