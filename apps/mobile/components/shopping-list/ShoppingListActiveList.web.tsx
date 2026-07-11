import { Fragment, type ReactNode } from 'react';

import type { ShoppingListDragRenderProps } from '@/components/shopping-list/shoppingListDndTypes';
import { Box } from '@/components/ui/box';
import type { ShoppingListItem } from '@/types/shoppingList';

interface ShoppingListActiveListProps {
  activeItems: ShoppingListItem[];
  allItems?: ShoppingListItem[];
  disabled?: boolean;
  onDraggingChange?: (isDragging: boolean) => void;
  onDragEnd?: (params: {
    reorderedItems: ShoppingListItem[];
    draggedIds: Set<number | string>;
    hoveredItem: ShoppingListItem | null;
    nestAsChild: boolean;
  }) => void;
  renderItem: (item: ShoppingListItem, dragProps?: ShoppingListDragRenderProps) => ReactNode;
}

export function ShoppingListActiveList({ activeItems, renderItem }: ShoppingListActiveListProps) {
  if (activeItems.length === 0) {
    return null;
  }

  return (
    <Box className="overflow-hidden rounded-2xl bg-surface px-2 py-2" testID="shopping-list-active-items">
      {activeItems.map((item) => (
        <Fragment key={String(item.id)}>{renderItem(item)}</Fragment>
      ))}
    </Box>
  );
}
