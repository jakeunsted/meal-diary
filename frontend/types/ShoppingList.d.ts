export interface ItemCategory {
  id: number;
  name: string;
  icon: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface ShoppingListItem {
  id: number;
  shopping_list_id: number;
  shopping_list_categories: number;
  name: string;
  checked: boolean;
  deleted: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface ShoppingListCategory {
  id: number;
  shopping_list_id: number;
  item_categories_id: number;
  created_at?: Date;
  updated_at?: Date;
  itemCategory?: ItemCategory;
  items?: ShoppingListItem[];
}

export interface ShoppingList {
  id: number;
  family_group_id: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface ShoppingListState {
  shoppingList: ShoppingList | null;
  categories: ShoppingListCategory[];
  items: ShoppingListItem[];
  isLoading: boolean;
  error: string | null;
}
