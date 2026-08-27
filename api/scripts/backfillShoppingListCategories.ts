import dotenv from 'dotenv';
import {
  SHOPPING_CATEGORIES,
  categorizeShoppingItemName,
  type ShoppingCategory,
} from '@meal-diary/shared';
import { initializeDatabase } from '../db/db.ts';
import ShoppingListItem from '../db/models/ShoppingListItem.model.ts';

dotenv.config();

/**
 * One-time backfill: assign categories from names and recompute contiguous
 * positions per (shopping_list_id, category).
 *
 *   npm run backfill-shopping-categories --workspace=meal-diary-api
 */
(async () => {
  try {
    console.log('Initializing database connection...');
    const dbInitialized = await initializeDatabase(false);
    if (!dbInitialized) {
      console.error('Failed to initialize database');
      process.exit(1);
    }

    console.log('Loading shopping list items...');
    const items = await ShoppingListItem.findAll({
      where: { deleted: false },
      order: [
        ['shopping_list_id', 'ASC'],
        ['position', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    console.log(`Found ${items.length} active items. Categorizing...`);

    for (const item of items) {
      const name = String(item.get('name') ?? '');
      const category = categorizeShoppingItemName(name);
      if (String(item.get('category')) !== category) {
        await item.update({ category });
      }
    }

    const listIds = [...new Set(items.map((item) => Number(item.get('shopping_list_id'))))];

    for (const shoppingListId of listIds) {
      for (const category of SHOPPING_CATEGORIES as readonly ShoppingCategory[]) {
        const siblings = await ShoppingListItem.findAll({
          where: {
            shopping_list_id: shoppingListId,
            category,
            deleted: false,
          },
          order: [
            ['position', 'ASC'],
            ['id', 'ASC'],
          ],
        });

        for (let index = 0; index < siblings.length; index += 1) {
          const sibling = siblings[index];
          if (Number(sibling.get('position')) !== index) {
            await sibling.update({ position: index });
          }
        }
      }
    }

    console.log('Shopping list category backfill completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error backfilling shopping list categories:', error);
    process.exit(1);
  }
})();
