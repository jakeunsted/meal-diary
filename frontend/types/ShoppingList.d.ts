export interface ShoppingListItem {
  id: number | string;
  shopping_list_id: number;
  name: string;
  checked: boolean;
  deleted: boolean;
  created_by: number;
  parent_item_id: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ShoppingList {
  id: number;
  family_group_id: number;
  created_at: string;
  updated_at: string;
  items: ShoppingListItem[];
}

export interface PendingShoppingListChanges {
  add: ShoppingListItem[];
  update: ShoppingListItem[];
  delete: number[];
  reorder: { id: number | string; parent_item_id: number | null; position: number }[];
}

export interface ShoppingListState {
  shoppingList: ShoppingList | null;
  isLoading: boolean;
  error: string | null;
  pendingChanges: PendingShoppingListChanges;
}
