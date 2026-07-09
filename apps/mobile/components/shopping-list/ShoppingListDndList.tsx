import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import { Box } from '@/components/ui/box';
import type { ShoppingListDragRenderProps } from '@/components/shopping-list/shoppingListDndTypes';
import {
  buildShoppingListDepthMap,
  getShoppingListItemDepth,
  resolveShoppingListDropHierarchy,
  resolveShoppingListDropHoveredItem,
  resolveShoppingListDropItemBelow,
  shouldNestShoppingListItemByOffset,
} from '@/lib/shopping-list/shoppingListDrop';
import type { ShoppingListItem } from '@/types/shoppingList';

interface ShoppingListDndListProps {
  activeItems: ShoppingListItem[];
  allItems: ShoppingListItem[];
  disabled?: boolean;
  onDraggingChange?: (isDragging: boolean) => void;
  onDragEnd: (params: {
    reorderedItems: ShoppingListItem[];
    draggedIds: Set<number | string>;
    hoveredItem: ShoppingListItem | null;
    nestAsChild: boolean;
  }) => void;
  renderItem: (item: ShoppingListItem, dragProps: ShoppingListDragRenderProps) => ReactNode;
}

export function ShoppingListDndList({
  activeItems,
  allItems,
  disabled = false,
  onDraggingChange,
  onDragEnd,
  renderItem,
}: ShoppingListDndListProps) {
  const [draggingId, setDraggingId] = useState<number | string | null>(null);
  const [nestPreview, setNestPreview] = useState(false);
  const dragFromIndexRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragPointerXRef = useRef(0);
  const nestAsChildRef = useRef(false);

  const depthMap = useMemo(() => buildShoppingListDepthMap(activeItems), [activeItems]);

  const handleDragBegin = useCallback(
    (index: number) => {
      if (disabled) {
        return;
      }

      dragFromIndexRef.current = index;
      dragStartXRef.current = dragPointerXRef.current;
      nestAsChildRef.current = false;
      setNestPreview(false);
      setDraggingId(activeItems[index]?.id ?? null);
      onDraggingChange?.(true);
    },
    [activeItems, disabled, onDraggingChange]
  );

  const handleDragPointerMove = useCallback((pageX: number) => {
    dragPointerXRef.current = pageX;
    if (dragFromIndexRef.current === null) {
      return;
    }

    const nestGesture = shouldNestShoppingListItemByOffset(
      pageX - dragStartXRef.current
    );
    nestAsChildRef.current = nestGesture;
    setNestPreview(nestGesture);
  }, []);

  const handleDragEnd = useCallback(
    ({ data, from, to }: { data: ShoppingListItem[]; from: number; to: number }) => {
      const draggedItem = data[to] ?? activeItems[from];
      const draggedIds = draggedItem
        ? new Set<number | string>([draggedItem.id])
        : new Set<number | string>();
      const itemAbove = draggedItem
        ? resolveShoppingListDropHoveredItem(data, from, to, draggedItem.id)
        : null;
      const itemBelow = draggedItem
        ? resolveShoppingListDropItemBelow(data, to, draggedItem.id)
        : null;
      // Keep-style: among children / between parent+child always nest;
      // under a root alone only with rightward gesture.
      const { hoveredItem, nestAsChild } = resolveShoppingListDropHierarchy(
        itemAbove,
        nestAsChildRef.current,
        allItems,
        itemBelow
      );

      onDragEnd({
        reorderedItems: data,
        draggedIds,
        hoveredItem,
        nestAsChild,
      });

      dragFromIndexRef.current = null;
      nestAsChildRef.current = false;
      setDraggingId(null);
      setNestPreview(false);
      onDraggingChange?.(false);
    },
    [activeItems, allItems, onDragEnd, onDraggingChange]
  );

  const renderDraggableItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<ShoppingListItem>) => {
      const depth = getShoppingListItemDepth(item, depthMap);
      const index = getIndex() ?? -1;
      const itemAbove = index > 0 ? activeItems[index - 1] : null;
      const showNestHint =
        isActive && nestPreview && !!itemAbove && itemAbove.parent_item_id === null;

      return (
        <ScaleDecorator activeScale={1.02}>
          <View
            style={[
              styles.row,
              isActive && styles.rowActive,
              showNestHint && styles.rowNesting,
            ]}
          >
            {renderItem(item, {
              drag: disabled ? () => undefined : drag,
              isActive,
              depth: showNestHint ? Math.max(depth, 1) : depth,
              isNestTarget: false,
              isDragPlaceholder: false,
              onDragPointerMove: handleDragPointerMove,
            })}
          </View>
        </ScaleDecorator>
      );
    },
    [activeItems, depthMap, disabled, handleDragPointerMove, nestPreview, renderItem]
  );

  if (activeItems.length === 0) {
    return null;
  }

  return (
    <Box className="overflow-hidden rounded-2xl bg-surface px-2 py-2" testID="shopping-list-active-items">
      <DraggableFlatList
        data={activeItems}
        extraData={`${draggingId}:${nestPreview}`}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderDraggableItem}
        onDragBegin={handleDragBegin}
        onDragEnd={handleDragEnd}
        activationDistance={10}
        scrollEnabled={false}
        containerStyle={draggingId ? styles.listDragging : undefined}
      />
    </Box>
  );
}

const styles = StyleSheet.create({
  listDragging: {
    overflow: 'visible',
  },
  row: {
    marginVertical: 2,
    borderRadius: 8,
  },
  rowActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  rowNesting: {
    marginLeft: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.45)',
  },
});
