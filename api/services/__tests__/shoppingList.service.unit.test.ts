import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/webhook.service.ts', () => ({
  sendShoppingListItemWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db/models/index.ts', () => ({
  default: {
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
  },
}));

const shoppingListFindOne = vi.fn();
const itemFindOne = vi.fn();
const itemCreate = vi.fn();
const itemMax = vi.fn();

vi.mock('../../db/models/ShoppingList.model.ts', () => ({
  default: {
    findOne: (...args: unknown[]) => shoppingListFindOne(...args),
    create: vi.fn(),
  },
}));

vi.mock('../../db/models/ShoppingListItem.model.ts', () => ({
  default: {
    findOne: (...args: unknown[]) => itemFindOne(...args),
    create: (...args: unknown[]) => itemCreate(...args),
    max: (...args: unknown[]) => itemMax(...args),
  },
}));

import { sendShoppingListItemWebhook } from '../../services/webhook.service.ts';
import { addItem, reorderItems, updateItem } from '../shoppingList.service.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ShoppingList Service categories', () => {
  describe('addItem', () => {
    it('auto-categorizes from name and scopes position to category', async () => {
      shoppingListFindOne.mockResolvedValue({ get: (key: string) => (key === 'id' ? 10 : null) });
      itemMax.mockResolvedValue(2);
      itemCreate.mockImplementation(async (values: Record<string, unknown>) => ({
        get: (key: string) => values[key],
        ...values,
      }));

      const item = await addItem(1, 'Chicken breast', 5);

      expect(itemMax).toHaveBeenCalledWith(
        'position',
        expect.objectContaining({
          where: expect.objectContaining({
            shopping_list_id: 10,
            category: 'meat',
            deleted: false,
          }),
        })
      );
      expect(itemCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Chicken breast',
          category: 'meat',
          position: 3,
        }),
        expect.anything()
      );
      expect(item.get('category')).toBe('meat');
      expect(sendShoppingListItemWebhook).toHaveBeenCalled();
    });

    it('uses an explicit category when provided', async () => {
      shoppingListFindOne.mockResolvedValue({ get: (key: string) => (key === 'id' ? 10 : null) });
      itemMax.mockResolvedValue(null);
      itemCreate.mockImplementation(async (values: Record<string, unknown>) => ({
        get: (key: string) => values[key],
        ...values,
      }));

      await addItem(1, 'Chicken breast', 5, 'bakery');

      expect(itemCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'bakery',
          position: 0,
        }),
        expect.anything()
      );
    });
  });

  describe('updateItem', () => {
    it('appends to the end of the target category when moving', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      itemFindOne.mockResolvedValue({
        get: (key: string) => {
          if (key === 'checked') return false;
          if (key === 'category') return 'meat';
          if (key === 'shopping_list_id') return 10;
          return null;
        },
        update,
      });
      itemMax.mockResolvedValue(4);

      await updateItem(1, 99, { category: 'bakery' }, 5);

      expect(itemMax).toHaveBeenCalledWith(
        'position',
        expect.objectContaining({
          where: expect.objectContaining({ category: 'bakery' }),
        })
      );
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'bakery', position: 5 }),
        expect.anything()
      );
      expect(sendShoppingListItemWebhook).toHaveBeenCalledWith(
        1,
        'move-item',
        expect.anything(),
        5
      );
    });
  });

  describe('reorderItems', () => {
    it('rejects invalid categories', async () => {
      await expect(
        reorderItems(1, [{ id: 1, category: 'dairy', position: 0 }])
      ).rejects.toThrow('Category must be a valid shopping category');
    });

    it('updates category and position for valid changes', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      itemFindOne.mockResolvedValue({
        get: () => null,
        update,
      });

      await reorderItems(1, [{ id: 1, category: 'other', position: 2 }], 7);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'other',
          position: 2,
        }),
        expect.anything()
      );
    });
  });
});
