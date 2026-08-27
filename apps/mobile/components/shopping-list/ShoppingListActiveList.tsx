import type { ReactNode } from 'react';

import {
  ShoppingListSortableList,
  type ShoppingListDragHandleProps,
} from '@/components/shopping-list/ShoppingListSortableList';
import type { ShoppingListItem } from '@/types/shoppingList';

interface ShoppingListActiveListProps {
  items: ShoppingListItem[];
  disabled?: boolean;
  onDraggingChange?: (isDragging: boolean) => void;
  onReorder: (orderedIds: Array<number | string>) => void;
  renderItem: (
    item: ShoppingListItem,
    dragHandleProps: ShoppingListDragHandleProps
  ) => ReactNode;
}

export function ShoppingListActiveList({
  items,
  disabled,
  onDraggingChange,
  onReorder,
  renderItem,
}: ShoppingListActiveListProps) {
  return (
    <ShoppingListSortableList
      items={items}
      disabled={disabled}
      onDraggingChange={onDraggingChange}
      onReorder={onReorder}
      renderItem={renderItem}
    />
  );
}
