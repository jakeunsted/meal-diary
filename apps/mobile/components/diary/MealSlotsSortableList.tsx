import { useCallback, type ReactNode } from 'react';

import {
  SortableList,
  type SortableDragHandleProps,
} from '@/components/ui/SortableList';

export interface MealSlotSortableItem {
  clientKey: string;
}

export type MealSlotsDragHandleProps = SortableDragHandleProps;

interface MealSlotsSortableListProps<T extends MealSlotSortableItem> {
  items: T[];
  onReorder: (orderedKeys: string[]) => void;
  renderItem: (item: T, dragHandleProps: MealSlotsDragHandleProps) => ReactNode;
  disabled?: boolean;
  onDraggingChange?: (isDragging: boolean) => void;
}

export function MealSlotsSortableList<T extends MealSlotSortableItem>({
  items,
  onReorder,
  renderItem,
  disabled = false,
  onDraggingChange,
}: MealSlotsSortableListProps<T>) {
  const getKey = useCallback((item: T) => item.clientKey, []);

  return (
    <SortableList
      items={items}
      getKey={getKey}
      onReorder={onReorder}
      renderItem={renderItem}
      disabled={disabled}
      onDraggingChange={onDraggingChange}
      activation="immediate"
      defaultRowHeight={38}
      testID="meal-slots-sortable-list"
      rowTestIDPrefix="meal-slot-sortable-row-"
    />
  );
}
