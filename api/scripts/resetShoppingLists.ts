import dotenv from 'dotenv';
import { initializeDatabase } from '../db/db.ts';
import ShoppingList from '../db/models/ShoppingList.model.ts';
import ShoppingListCategory from '../db/models/ShoppingListCategory.model.ts';
import ShoppingListItem from '../db/models/ShoppingListItem.model.ts';

dotenv.config();

/**
 * Script to clear all existing shopping list data.
 * This will remove all shopping lists, categories, and items for every family group.
 * Usage: add an npm script such as
 *   "reset-shopping-lists": "node --experimental-strip-types --experimental-transform-types scripts/resetShoppingLists.ts"
 * and run it manually when deploying the new single-list shopping feature.
 */
(async () => {
  try {
    console.log('Initializing database connection...');
    const dbInitialized = await initializeDatabase(false);
    if (!dbInitialized) {
      console.error('Failed to initialize database');
      process.exit(1);
    }

    console.log('Clearing shopping list items...');
    await ShoppingListItem.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true
    });

    console.log('Clearing shopping list categories...');
    await ShoppingListCategory.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true
    });

    console.log('Clearing shopping lists...');
    await ShoppingList.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true
    });

    console.log('All shopping list data cleared successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing shopping list data:', error);
    process.exit(1);
  }
})();

