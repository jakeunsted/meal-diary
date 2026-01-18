import ItemCategory, { type ItemCategoryAttributes } from '../db/models/ItemCategory.model.ts';

export interface CreateItemCategoryData {
  name: string;
  icon?: string;
}

export interface UpdateItemCategoryData {
  name?: string;
  icon?: string;
}

/**
 * Get all item categories
 * @returns {Promise<ItemCategory[]>} Array of item categories ordered by name
 */
export const getAllItemCategories = async (): Promise<ItemCategory[]> => {
  const categories = await ItemCategory.findAll({
    order: [['name', 'ASC']]
  });

  return categories;
};

/**
 * Get item category by ID
 * @param {number} id - Item category ID
 * @returns {Promise<ItemCategory>} Item category
 * @throws {Error} If category not found
 */
export const getItemCategoryById = async (id: number): Promise<ItemCategory> => {
  const category = await ItemCategory.findByPk(id);

  if (!category) {
    throw new Error('Item category not found');
  }

  return category;
};

/**
 * Create a new item category
 * @param {CreateItemCategoryData} data - Category data
 * @returns {Promise<ItemCategory>} Created item category
 * @throws {Error} If validation fails
 */
export const createItemCategory = async (data: CreateItemCategoryData): Promise<ItemCategory> => {
  const { name, icon } = data;

  if (!name) {
    throw new Error('Name is required');
  }

  const category = await ItemCategory.create({ name, icon });

  return category;
};

/**
 * Update an item category
 * @param {number} id - Item category ID
 * @param {UpdateItemCategoryData} data - Category data to update
 * @returns {Promise<ItemCategory>} Updated item category
 * @throws {Error} If category not found
 */
export const updateItemCategory = async (id: number, data: UpdateItemCategoryData): Promise<ItemCategory> => {
  const { name, icon } = data;

  const category = await ItemCategory.findByPk(id);

  if (!category) {
    throw new Error('Item category not found');
  }

  await category.update({ name, icon });

  return category;
};

/**
 * Delete an item category
 * @param {number} id - Item category ID
 * @returns {Promise<{ id: number; name: string }>} Deleted category info
 * @throws {Error} If category not found
 */
export const deleteItemCategory = async (id: number): Promise<{ id: number; name: string }> => {
  const category = await ItemCategory.findByPk(id);

  if (!category) {
    throw new Error('Item category not found');
  }

  const categoryName = category.get('name') as string;
  await category.destroy();

  return { id, name: categoryName };
};
