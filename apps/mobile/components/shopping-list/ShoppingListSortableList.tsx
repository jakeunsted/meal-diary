import { useCallback, useMemo, type ReactNode } from 'react';

import {
  SortableList,
  type SortableDragHandleProps,
} from '@/components/ui/SortableList';
import type { ShoppingListItem } from '@/types/shoppingList';

export type ShoppingListDragHandleProps = SortableDragHandleProps;

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

export function ShoppingListSortableList({
  items,
  onReorder,
  renderItem,
  disabled = false,
  onDraggingChange,
}: ShoppingListSortableListProps) {
  const idByKey = useMemo(() => {
    const map = new Map<string, number | string>();
    for (const item of items) {
      map.set(String(item.id), item.id);
    }
    return map;
  }, [items]);

  const getKey = useCallback((item: ShoppingListItem) => String(item.id), []);

  const handleReorder = useCallback(
    (orderedKeys: string[]) => {
      onReorder(orderedKeys.map((key) => idByKey.get(key) ?? key));
    },
    [idByKey, onReorder]
  );

  return (
    <SortableList
      items={items}
      getKey={getKey}
      onReorder={handleReorder}
      renderItem={renderItem}
      disabled={disabled}
      onDraggingChange={onDraggingChange}
      activation="longPress"
      defaultRowHeight={48}
      testID="shopping-list-active-items"
      rowTestIDPrefix="shopping-list-sortable-row-"
    />
  );
}
