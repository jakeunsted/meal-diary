import type { ShoppingCategory } from './categories.ts';

export interface ShoppingListItemLike {
  id: number | string;
  category: ShoppingCategory;
  position: number;
  checked?: boolean;
  deleted?: boolean;
  name?: string;
}

export interface ShoppingListReorderChange {
  id: number | string;
  category: ShoppingCategory;
  position: number;
}
