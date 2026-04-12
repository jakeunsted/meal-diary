export interface ItemCategory {
  id: number;
  name: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: number | string;
  shopping_list_id: number;
  shopping_list_categories: number;
  name: string;
  checked: boolean;
  deleted: boolean;
  created_by: number;
  parent_item_id: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListCategory {
  id: number;
  shopping_list_id: number;
  item_categories_id: number;
  created_by: number;
  created_at?: Date;
  updated_at?: Date;
  itemCategory: ItemCategory;
  items: ShoppingListItem[];
}

export interface ShoppingList {
  id: number;
  family_group_id: number;
  created_at: string;
  updated_at: string;
  items: ShoppingListItem[];
  categories: ShoppingListCategoryWithItems[];
}

export interface ShoppingListCategoryWithItems {
  id: number;
  shopping_list_id: number;
  item_categories_id: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  itemCategory: ItemCategory;
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
  itemCategories: ItemCategory[];
  isLoading: boolean;
  error: string | null;
  pendingChanges: PendingShoppingListChanges;
}
