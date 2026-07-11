export interface ShoppingListDragRenderProps {
  drag: () => void;
  isActive: boolean;
  depth: number;
  isNestTarget: boolean;
  isDragPlaceholder: boolean;
  onDragPointerMove: (pageX: number) => void;
}
