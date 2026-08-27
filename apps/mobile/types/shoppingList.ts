import type { ShoppingCategory } from '@meal-diary/shared';

export interface ShoppingListItem {
  id: number | string;
  shopping_list_id: number;
  name: string;
  checked: boolean;
  deleted: boolean;
  created_by: number;
  category: ShoppingCategory;
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

export interface ShoppingListItemReorderChange {
  id: number | string;
  category: ShoppingCategory;
  position: number;
}

export interface ShoppingListPendingAddOp {
  opId: string;
  type: 'add';
  familyGroupId: number;
  tempId: string;
  name: string;
  category?: ShoppingCategory;
}

export interface ShoppingListPendingUpdateOp {
  opId: string;
  type: 'update';
  familyGroupId: number;
  itemId: number | string;
  updates: { name?: string; checked?: boolean; category?: ShoppingCategory };
}

export interface ShoppingListPendingDeleteOp {
  opId: string;
  type: 'delete';
  familyGroupId: number;
  itemId: number | string;
}

export interface ShoppingListPendingBulkUpdateOp {
  opId: string;
  type: 'bulkUpdate';
  familyGroupId: number;
  items: Array<{
    id: number | string;
    name?: string;
    checked?: boolean;
    category?: ShoppingCategory;
  }>;
}

export interface ShoppingListPendingBulkDeleteOp {
  opId: string;
  type: 'bulkDelete';
  familyGroupId: number;
  ids: Array<number | string>;
}

export interface ShoppingListPendingReorderOp {
  opId: string;
  type: 'reorder';
  familyGroupId: number;
  items: ShoppingListItemReorderChange[];
}

export interface ShoppingListPendingBulkAddOp {
  opId: string;
  type: 'bulkAdd';
  familyGroupId: number;
  items: Array<{ name: string; category?: ShoppingCategory }>;
}

export type ShoppingListPendingOp =
  | ShoppingListPendingAddOp
  | ShoppingListPendingUpdateOp
  | ShoppingListPendingDeleteOp
  | ShoppingListPendingBulkUpdateOp
  | ShoppingListPendingBulkDeleteOp
  | ShoppingListPendingReorderOp
  | ShoppingListPendingBulkAddOp;
