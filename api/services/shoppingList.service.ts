import ShoppingList from '../db/models/ShoppingList.model.ts';
import type { ShoppingListCategory } from '../db/models/ShoppingList.model.ts';

/**
 * Creates a base shopping list for a family group
 * @param {number} family_group_id - ID of the family group
 * @returns {Promise<ShoppingList>} The newly created shopping list
 * @throws {Error} If shopping list not found
 */
export const createBaseShoppingList = async (family_group_id: number): Promise<ShoppingList> => {
  try {
    const shoppingList = await ShoppingList.create({ family_group_id });
    return shoppingList;
  } catch (error) {
    throw new Error('Failed to create base shopping list');
  }
};

/**
 * Adds a new category to a family group's shopping list
 * @param {number} family_group_id - ID of the family group
 * @param {string} category_name - Name of the new category
 * @returns {Promise<ShoppingListCategory>} The newly created category
 * @throws {Error} If shopping list not found
 */
export const addNewCategory = async (family_group_id: number, category_name: string): Promise<ShoppingListCategory> => {
  let shoppingList = await ShoppingList.findOne({
    where: {
      family_group_id,
    },
  });

  if (!shoppingList) {
    // Create new shopping list
    shoppingList = await ShoppingList.create({
      family_group_id,
      content: {
        categories: [],
      },
    });
  }

  const newCategory = {
    name: category_name,
    items: [],
  };

  // Handling null content case
  if (!shoppingList.dataValues.content) {
    shoppingList.dataValues.content = {
      categories: [newCategory],
    };
  } else {
    shoppingList.dataValues.content.categories.push(newCategory);
  }

  shoppingList.changed('content' as any, true);

  await shoppingList.save();

  return shoppingList.dataValues.content.categories.find(category => category.name === category_name) as ShoppingListCategory;
}

/**
 * Replaces a category's contents with new values
 * @param {number} family_group_id - ID of the family group
 * @param {string} category_name - Name of the category to update
 * @param {ShoppingListCategory} category_contents - The new category contents
 * @returns {Promise<ShoppingListCategory>} The updated category
 * @throws {Error} If shopping list not found or category not found
 */
export const replaceCategoryContents = async (family_group_id: number, category_name: string, category_contents: ShoppingListCategory) => {
  const shoppingList = await ShoppingList.findOne({
    where: {
      family_group_id,
    },
  });

  if (!shoppingList) {
    throw new Error('Shopping list not found');
  }

  const categoryIndex = shoppingList.dataValues.content.categories.findIndex(category => category.name === category_name);
  if (categoryIndex === -1) {
    throw new Error('Category not found');
  }

  shoppingList.dataValues.content.categories[categoryIndex] = category_contents;
  
  shoppingList.changed('content' as any, true);

  await shoppingList.save();

  return shoppingList.dataValues.content.categories.find(category => category.name === category_name) as ShoppingListCategory;
}
