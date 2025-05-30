import express from 'express';
import * as shoppingListController from '../controllers/shopping-list/shoppingList.controller.ts';

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     ShoppingList:
 *       type: object
 *       required:
 *         - family_group_id
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the shopping list
 *         family_group_id:
 *           type: integer
 *           description: The id of the family group the shopping list belongs to
 *         created_at:  
 *           type: string
 *           format: date-time
 *           description: The date and time the shopping list was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the shopping list was last updated
 *         categories:
 *           type: array
 *           description: The categories in the shopping list
 *           items:
 *             $ref: '#/components/schemas/ShoppingListCategoryWithItems'
 * 
 *     ShoppingListCategoryWithItems:
 *       type: object
 *       required:
 *         - id
 *         - shopping_list_id
 *         - item_categories_id
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the shopping list category
 *         shopping_list_id:
 *           type: integer
 *           description: The id of the shopping list
 *         item_categories_id:
 *           type: integer
 *           description: The id of the item category
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the category was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the category was last updated
 *         itemCategory:
 *           $ref: '#/components/schemas/ItemCategory'
 *         items:
 *           type: array
 *           description: The items in this category
 *           items:
 *             $ref: '#/components/schemas/ShoppingListItem'
 * 
 *     ItemCategory:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the item category
 *         name:
 *           type: string
 *           description: The name of the category
 *         icon:
 *           type: string
 *           description: The icon identifier for the category
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the category was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the category was last updated
 *     
 *     ShoppingListCategory:
 *       type: object
 *       required:
 *         - shopping_list_id
 *         - item_categories_id
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the shopping list category
 *         shopping_list_id:
 *           type: integer
 *           description: The id of the shopping list
 *         item_categories_id:
 *           type: integer
 *           description: The id of the item category
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the category was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the category was last updated
 * 
 *     ShoppingListItem:
 *       type: object
 *       required:
 *         - shopping_list_id
 *         - shopping_list_categories
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the shopping list item
 *         shopping_list_id:
 *           type: integer
 *           description: The id of the shopping list
 *         shopping_list_categories:
 *           type: integer
 *           description: The id of the shopping list category
 *         name:
 *           type: string
 *           description: The name of the item
 *         checked:
 *           type: boolean
 *           description: Whether the item has been checked off
 *         deleted:
 *           type: boolean
 *           description: Whether the item has been deleted
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the item was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the item was last updated
 */

/**
 * @openapi
 * /shopping-list/{family_group_id}/create-shopping-list:
 *   post:
 *     summary: Create a base shopping list for a family group
 *     description: Creates a base shopping list for a family group
 *     tags:
 *       - Shopping List
 *     parameters:
 *       - name: family_group_id
 *         in: path
 *         required: true
 *         description: The id of the family group
 *     responses:
 *       200:
 *         description: The newly created shopping list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingList'
 *       500:
 *         description: Server error
 */
router.post('/:family_group_id/create-shopping-list', async (req, res, next) => {
  try {
    await shoppingListController.createBaseShoppingList(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /shopping-list/{family_group_id}:
 *   get:
 *     summary: Get the entire shopping list
 *     description: Retrieves the shopping list with all its categories and items for a family group
 *     parameters:
 *       - name: family_group_id
 *         in: path
 *         required: true
 *         description: The id of the family group
 *         schema:
 *           type: integer
 *     tags:
 *       - Shopping List
 *     responses:
 *       200:
 *         description: The shopping list with all its categories and items
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingList'
 *       404:
 *         description: Shopping list not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Shopping list not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Failed to get shopping list
 */
router.get('/:family_group_id', async (req, res, next) => {
  try {
    await shoppingListController.getEntireShoppingList(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /shopping-list/{family_group_id}/categories:
 *   post:
 *     summary: Add a new category to a shopping list
 *     description: Creates a new category in the shopping list
 *     tags:
 *       - Shopping List
 *     parameters:
 *       - name: family_group_id
 *         in: path
 *         required: true
 *         description: The id of the family group
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - icon
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the new category
 *               icon:
 *                 type: string
 *                 description: The icon identifier for the category
 *     responses:
 *       200:
 *         description: The newly created category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingListCategory'
 *       404:
 *         description: Shopping list category not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Shopping list not found
 *       412:
 *         description: Name is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Name is required
 *       500:
 *         description: Failed to add new category
 */
router.post('/:family_group_id/categories', async (req, res, next) => {
  try {
    await shoppingListController.addCategory(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /shopping-list/{family_group_id}/categories/{category_id}:
 *   put:
 *     summary: Update a category in the shopping list
 *     description: Updates an existing category in the shopping list
 *     tags:
 *       - Shopping List
 *     parameters:
 *       - name: family_group_id
 *         in: path
 *         required: true
 *         description: The id of the family group
 *       - name: category_id
 *         in: path
 *         required: true
 *         description: The id of the category to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The new name of the category
 *               icon:
 *                 type: string
 *                 description: The new icon identifier for the category
 *     responses:
 *       200:
 *         description: The updated category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingListCategory'
 *       404:
 *         description: Category not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Category not found
 *       500:
 *         description: Failed to update category
 */
router.put('/:family_group_id/categories/:category_id', async (req, res, next) => {
  try {
    await shoppingListController.updateCategory(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /shopping-list/{family_group_id}/categories/{category_id}:
 *   delete:
 *     summary: Delete a category from the shopping list
 *     description: Deletes a category and all its items from the shopping list
 *     tags:
 *       - Shopping List
 *     parameters:
 *       - name: family_group_id
 *         in: path
 *         required: true
 *         description: The id of the family group
 *       - name: category_id
 *         in: path
 *         required: true
 *         description: The id of the category to delete
 *     responses:
 *       200:
 *         description: The deleted category
 *       404:
 *         description: Category not found
 *       500:
 *         description: Failed to delete category
 */
router.delete('/:family_group_id/categories/:category_id', async (req, res, next) => {
  try {
    await shoppingListController.deleteCategory(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /shopping-list/{family_group_id}/items:
 *   post:
 *     summary: Add a new item to a shopping list
 *     description: Creates a new item in a specific category of the shopping list
 *     tags:
 *       - Shopping List
 *     parameters:
 *       - name: family_group_id
 *         in: path
 *         required: true
 *         description: The id of the family group
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - shopping_list_categories
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the new item
 *               shopping_list_categories:
 *                 type: integer
 *                 description: The id of the category to add the item to
 *     responses:
 *       200:
 *         description: The newly created item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingListItem'
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Shopping list or category not found
 *       500:
 *         description: Failed to add new item
 */
router.post('/:family_group_id/items', async (req, res, next) => {
  try {
    await shoppingListController.addItem(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /shopping-list/{family_group_id}/items/{item_id}:
 *   put:
 *     summary: Update a shopping list item
 *     description: Updates an existing item in the shopping list
 *     tags:
 *       - Shopping List
 *     parameters:
 *       - name: family_group_id
 *         in: path
 *         required: true
 *         description: The id of the family group
 *       - name: item_id
 *         in: path
 *         required: true
 *         description: The id of the item to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The new name of the item
 *               checked:
 *                 type: boolean
 *                 description: Whether the item is checked
 *               shopping_list_categories:
 *                 type: integer
 *                 description: The id of the category to move the item to
 *     responses:
 *       200:
 *         description: The updated item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingListItem'
 *       404:
 *         description: Item or category not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Item or category not found
 *       500:
 *         description: Failed to update item
 */
router.put('/:family_group_id/items/:item_id', async (req, res, next) => {
  try {
    await shoppingListController.updateItem(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /shopping-list/{family_group_id}/items/{item_id}:
 *   delete:
 *     summary: Delete a shopping list item
 *     description: Soft deletes an item from the shopping list
 *     tags:
 *       - Shopping List
 *     parameters:
 *       - name: family_group_id
 *         in: path
 *         required: true
 *         description: The id of the family group
 *       - name: item_id
 *         in: path
 *         required: true
 *         description: The id of the item to delete
 *     responses:
 *       200:
 *         description: The deleted item
 *       404:
 *         description: Item not found
 *       500:
 *         description: Failed to delete item
 */
router.delete('/:family_group_id/items/:item_id', async (req, res, next) => {
  try {
    await shoppingListController.deleteItem(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;