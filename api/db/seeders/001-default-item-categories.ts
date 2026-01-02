import ItemCategory from '../models/ItemCategory.model.ts';

/**
 * Default item categories for shopping lists
 * These categories represent common grocery store sections
 * Icons use FontAwesome icon names (solid style)
 */
const defaultItemCategories = [
  { name: 'Produce', icon: 'apple-whole' },
  { name: 'Meat & Seafood', icon: 'fish' },
  { name: 'Dairy', icon: 'cheese' },
  { name: 'Bakery', icon: 'bread-slice' },
  { name: 'Frozen', icon: 'snowflake' },
  { name: 'Pantry', icon: 'shopping-bag' },
  { name: 'Beverages', icon: 'mug-hot' },
  { name: 'Snacks', icon: 'cookie' },
  { name: 'Deli', icon: 'utensils' },
  { name: 'Cereal & Breakfast', icon: 'utensils' },
  { name: 'Canned Goods', icon: 'archive' },
  { name: 'Spices & Seasonings', icon: 'fire' },
  { name: 'Condiments', icon: 'wine-glass' },
  { name: 'Pasta & Rice', icon: 'utensils' },
  { name: 'Baking', icon: 'cake' },
  { name: 'Health & Beauty', icon: 'spray-can' },
  { name: 'Household', icon: 'broom' },
  { name: 'Baby & Kids', icon: 'baby' },
  { name: 'Pet Supplies', icon: 'paw' },
  { name: 'Other', icon: 'box' },
];

/**
 * Seeds default item categories into the database
 * This function is idempotent - it will not create duplicates
 */
export const seedDefaultItemCategories = async (): Promise<void> => {
  try {
    console.log('Seeding default item categories...');

    for (const category of defaultItemCategories) {
      // Check if category already exists
      const existingCategory = await ItemCategory.findOne({
        where: { name: category.name },
      });

      if (!existingCategory) {
        await ItemCategory.create({
          name: category.name,
          icon: category.icon,
        });
        console.log(`Created category: ${category.name}`);
      } else {
        console.log(`Category already exists: ${category.name}`);
      }
    }

    console.log('Default item categories seeded successfully.');
  } catch (error) {
    console.error('Error seeding default item categories:', error);
    throw error;
  }
};

/**
 * Removes all default item categories (useful for testing/resetting)
 */
export const unseedDefaultItemCategories = async (): Promise<void> => {
  try {
    console.log('Removing default item categories...');

    for (const category of defaultItemCategories) {
      await ItemCategory.destroy({
        where: { name: category.name },
      });
    }

    console.log('Default item categories removed successfully.');
  } catch (error) {
    console.error('Error removing default item categories:', error);
    throw error;
  }
};

