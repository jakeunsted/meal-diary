import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../db/models/associations.ts', () => ({
  User: class User {},
}));

vi.mock('../../services/shoppingList.service.ts', () => ({
  createBaseShoppingList: vi.fn(),
  getEntireShoppingList: vi.fn(),
  addItem: vi.fn(),
  bulkAddItems: vi.fn(),
  reorderItems: vi.fn(),
  bulkUpdateItems: vi.fn(),
  bulkDeleteItems: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

vi.mock('../../utils/posthog.ts', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

import * as ShoppingListService from '../../services/shoppingList.service.ts';
import {
  addItem,
  bulkAddItems,
  bulkDeleteItems,
  bulkUpdateItems,
  createBaseShoppingList,
  deleteItem,
  getEntireShoppingList,
  reorderItems,
  updateItem,
} from '../shopping-list/shoppingList.controller.ts';

const mockResponse = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

const mockRequest = (params: Record<string, string> = {}, body: Record<string, unknown> = {}) =>
  ({
    params,
    body,
    user: { dataValues: { id: 5 } },
  }) as unknown as Request;

const item = (id: number) => ({
  get: (key: string) => (key === 'id' ? id : undefined),
});

describe('shoppingList.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and loads a shopping list', async () => {
    vi.mocked(ShoppingListService.createBaseShoppingList).mockResolvedValue({ id: 1 } as never);
    const created = mockResponse();
    await createBaseShoppingList(mockRequest({ family_group_id: '9' }), created);
    expect(created.json).toHaveBeenCalledWith({ id: 1 });

    vi.mocked(ShoppingListService.getEntireShoppingList).mockResolvedValue(null as never);
    const missing = mockResponse();
    await getEntireShoppingList(mockRequest({ family_group_id: '9' }), missing);
    expect(missing.status).toHaveBeenCalledWith(404);

    const list = item(2);
    vi.mocked(ShoppingListService.getEntireShoppingList).mockResolvedValue(list as never);
    const loaded = mockResponse();
    await getEntireShoppingList(mockRequest({ family_group_id: '9' }), loaded);
    expect(loaded.json).toHaveBeenCalledWith(list);
  });

  it('adds one item and a batch, rejecting empty names and unknown categories', async () => {
    vi.mocked(ShoppingListService.addItem).mockResolvedValue(item(3) as never);
    const added = mockResponse();
    await addItem(mockRequest({ family_group_id: '9' }, { name: ' Milk ', category: 'dairy' }), added);
    expect(ShoppingListService.addItem).toHaveBeenCalledWith(9, 'Milk', 5, 'dairy');
    expect(added.json).toHaveBeenCalled();

    const empty = mockResponse();
    await addItem(mockRequest({ family_group_id: '9' }, { name: '  ' }), empty);
    expect(empty.status).toHaveBeenCalledWith(400);

    const badCategory = mockResponse();
    await addItem(mockRequest({ family_group_id: '9' }, { name: 'Milk', category: 'snacks' }), badCategory);
    expect(badCategory.status).toHaveBeenCalledWith(400);

    vi.mocked(ShoppingListService.addItem).mockRejectedValueOnce(new Error('Shopping list not found'));
    const missing = mockResponse();
    await addItem(mockRequest({ family_group_id: '9' }, { name: 'Milk' }), missing);
    expect(missing.status).toHaveBeenCalledWith(404);

    vi.mocked(ShoppingListService.bulkAddItems).mockResolvedValue([item(4)] as never);
    const bulk = mockResponse();
    await bulkAddItems(mockRequest({ family_group_id: '9' }, { items: [{ name: 'Bread', category: 'bakery' }] }), bulk);
    expect(bulk.json).toHaveBeenCalled();

    const emptyBatch = mockResponse();
    await bulkAddItems(mockRequest({ family_group_id: 'nope' }, { items: [] }), emptyBatch);
    expect(emptyBatch.status).toHaveBeenCalledWith(400);
  });

  it('reorders, updates, and deletes items', async () => {
    vi.mocked(ShoppingListService.reorderItems).mockResolvedValue([item(1)] as never);
    const reordered = mockResponse();
    await reorderItems(mockRequest({ family_group_id: '9' }, {
      items: [{ id: 1, category: 'other', position: 0 }],
    }), reordered);
    expect(reordered.json).toHaveBeenCalled();

    vi.mocked(ShoppingListService.reorderItems).mockRejectedValueOnce(new Error('Item not found'));
    const missing = mockResponse();
    await reorderItems(mockRequest({ family_group_id: '9' }, {
      items: [{ id: 1, category: 'other', position: 0 }],
    }), missing);
    expect(missing.status).toHaveBeenCalledWith(404);

    vi.mocked(ShoppingListService.reorderItems).mockRejectedValueOnce(new Error('Category must be valid'));
    const bad = mockResponse();
    await reorderItems(mockRequest({ family_group_id: '9' }, {
      items: [{ id: 1, category: 'other', position: 0 }],
    }), bad);
    expect(bad.status).toHaveBeenCalledWith(400);

    vi.mocked(ShoppingListService.bulkUpdateItems).mockResolvedValue([item(1)] as never);
    const updated = mockResponse();
    await bulkUpdateItems(mockRequest({ family_group_id: '9' }, { items: [{ id: 1, checked: true }] }), updated);
    expect(updated.json).toHaveBeenCalled();

    vi.mocked(ShoppingListService.bulkDeleteItems).mockResolvedValue([item(1)] as never);
    const deleted = mockResponse();
    await bulkDeleteItems(mockRequest({ family_group_id: '9' }, { ids: [1] }), deleted);
    expect(deleted.json).toHaveBeenCalled();

    const noFields = mockResponse();
    await updateItem(mockRequest({ family_group_id: '9', item_id: '1' }, {}), noFields);
    expect(noFields.status).toHaveBeenCalledWith(400);

    vi.mocked(ShoppingListService.updateItem).mockResolvedValue(item(1) as never);
    const one = mockResponse();
    await updateItem(mockRequest({ family_group_id: '9', item_id: '1' }, { checked: true }), one);
    expect(one.json).toHaveBeenCalled();

    vi.mocked(ShoppingListService.deleteItem).mockResolvedValue(item(1) as never);
    const removed = mockResponse();
    await deleteItem(mockRequest({ family_group_id: '9', item_id: '1' }), removed);
    expect(removed.json).toHaveBeenCalled();

    vi.mocked(ShoppingListService.deleteItem).mockRejectedValueOnce(new Error('boom'));
    const failed = mockResponse();
    await deleteItem(mockRequest({ family_group_id: '9', item_id: '1' }), failed);
    expect(failed.status).toHaveBeenCalledWith(500);
  });
});
