export interface ShoppingListItem {
  name: string;
  checked: boolean;
}

export interface ShoppingListCategory {
  name: string;
  items: ShoppingListItem[];
}

export interface SSEShoppingListCategoryUpdate {
  categoryName: string;
  categoryContents: ShoppingListCategory;
}

export interface ShoppingListContent {
  categories: ShoppingListCategory[];
}

export interface ShoppingList {
  id: number;
  family_group_id: number;
  content: ShoppingListContent;
  created_at?: Date;
  updated_at?: Date;
}

export interface ShoppingListState {
  shoppingList: ShoppingList | null;
  isLoading: boolean;
  error: string | null;
}
