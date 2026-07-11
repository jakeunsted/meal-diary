import type { ReactNode } from 'react';

import { ShoppingListDndList } from '@/components/shopping-list/ShoppingListDndList';
import type { ShoppingListDragRenderProps } from '@/components/shopping-list/shoppingListDndTypes';
import type { ShoppingListItem } from '@/types/shoppingList';

interface ShoppingListActiveListProps {
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
  renderItem: (item: ShoppingListItem, dragProps?: ShoppingListDragRenderProps) => ReactNode;
}

export function ShoppingListActiveList({
  activeItems,
  allItems,
  disabled,
  onDraggingChange,
  onDragEnd,
  renderItem,
}: ShoppingListActiveListProps) {
  return (
    <ShoppingListDndList
      activeItems={activeItems}
      allItems={allItems}
      disabled={disabled}
      onDraggingChange={onDraggingChange}
      onDragEnd={onDragEnd}
      renderItem={(item, dragProps) => renderItem(item, dragProps)}
    />
  );
}
