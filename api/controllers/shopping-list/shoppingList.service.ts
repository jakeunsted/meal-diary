import { ShoppingList } from '../../db/models/associations.ts';
import type { ShoppingListCategory } from '../../db/models/ShoppingList.model.ts';

/**
 * Adds a new category to a family group's shopping list
 * @param {number} family_group_id - ID of the family group
 * @param {string} category_name - Name of the new category
 * @returns {Promise<ShoppingListCategory>} The newly created category
 * @throws {Error} If shopping list not found
 */
export const addNewCategory = async (family_group_id: number, category_name: string): Promise<ShoppingListCategory> => {
  const shoppingList = await ShoppingList.findOne({
    where: {
      family_group_id,
    },
  });

  if (!shoppingList) {
    throw new Error('Shopping list not found');
  }

  const newCategory = {
    name: category_name,
    items: [],
  };

  // Content is init null, so we need to set it to an empty object with new category
  if (!shoppingList.dataValues.content) {
    shoppingList.dataValues.content = {
      categories: [newCategory],
    };
  } else {
    shoppingList.dataValues.content.categories.push(newCategory);
  }

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
  await shoppingList.save();

  return shoppingList.dataValues.content.categories.find(category => category.name === category_name) as ShoppingListCategory;
}
