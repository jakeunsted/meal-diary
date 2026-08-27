import express from 'express';
import * as shoppingListController from '../controllers/shopping-list/shoppingList.controller.ts';
import { authenticateToken, requireFamilyMember } from '../middleware/auth.middleware.ts';
import { requireEntitlement } from '../middleware/entitlement.middleware.ts';

const router = express.Router();
router.use(authenticateToken);
// Every route below is scoped to /:family_group_id — members only
router.use('/:family_group_id', requireFamilyMember);

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
 *         items:
 *           type: array
 *           description: The items in the shopping list
 *           items:
 *             $ref: '#/components/schemas/ShoppingListItem'
 *
 *     ShoppingListItem:
 *       type: object
 *       required:
 *         - shopping_list_id
 *         - name
 *         - created_by
 *         - category
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the shopping list item
 *         shopping_list_id:
 *           type: integer
 *           description: The id of the shopping list
 *         category:
 *           type: string
 *           enum: [meat, fruit_veg, bakery, canned, other]
 *           description: Fixed system category for the item
 *         position:
 *           type: integer
 *           description: The position of the item within its category
 *         name:
 *           type: string
 *           description: The name of the item
 *         checked:
 *           type: boolean
 *           description: Whether the item has been checked off
 *         deleted:
 *           type: boolean
 *           description: Whether the item has been deleted
 *         created_by:
 *           type: integer
 *           description: The id of the user who created the item
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
 * /shopping-list/{family_group_id}/items:
 *   post:
 *     summary: Add a new item to a shopping list
 *     description: Creates a new item in the shopping list
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
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the new item
 *               category:
 *                 type: string
 *                 enum: [meat, fruit_veg, bakery, canned, other]
 *                 description: Optional category; auto-categorized from name when omitted
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
 * /shopping-list/{family_group_id}/items/bulk:
 *   post:
 *     summary: Add multiple new items to a shopping list
 *     description: Creates multiple new items in the shopping list in a single request
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
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: The name of the new item
 *                     category:
 *                       type: string
 *                       enum: [meat, fruit_veg, bakery, canned, other]
 *                       description: Optional category; auto-categorized from name when omitted
 *     responses:
 *       200:
 *         description: The newly created items
 *       400:
 *         description: Validation error
 *       404:
 *         description: Shopping list not found
 *       500:
 *         description: Failed to add new items
 */
router.post('/:family_group_id/items/bulk', requireEntitlement('recipe_to_shopping_list'), async (req, res, next) => {
  try {
    await shoppingListController.bulkAddItems(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /shopping-list/{family_group_id}/items/reorder:
 *   put:
 *     summary: Reorder shopping list items
 *     description: Updates category and position for one or more shopping list items
 *     tags:
 *       - Shopping List
 *     parameters:
 *       - name: family_group_id
 *         in: path
 *         required: true
 *         description: The id of the family group
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - category
 *                     - position
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: The id of the item to move
 *                     category:
 *                       type: string
 *                       enum: [meat, fruit_veg, bakery, canned, other]
 *                       description: The category for the item
 *                     position:
 *                       type: integer
 *                       description: The new position within the category
 *     responses:
 *       200:
 *         description: The updated items
 *       400:
 *         description: Validation error
 *       404:
 *         description: Item not found
 *       500:
 *         description: Failed to reorder items
 */
router.put('/:family_group_id/items/reorder', async (req, res, next) => {
  try {
    await shoppingListController.reorderItems(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /shopping-list/{family_group_id}/items/bulk-update:
 *   put:
 *     summary: Bulk update shopping list items
 *     description: Updates name and/or checked for one or more shopping list items in a single request
 *     tags:
 *       - Shopping List
 *     parameters:
 *       - name: family_group_id
 *         in: path
 *         required: true
 *         description: The id of the family group
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                   minProperties: 2
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: The id of the item to update
 *                     name:
 *                       type: string
 *                       description: The new name of the item
 *                     checked:
 *                       type: boolean
 *                       description: Whether the item is checked
 *                     deleted:
 *                       type: boolean
 *                       description: Whether the item is soft-deleted (set false to restore)
 *     responses:
 *       200:
 *         description: The updated items
 *       400:
 *         description: Validation error
 *       404:
 *         description: Item not found
 *       500:
 *         description: Failed to update items
 */
router.put('/:family_group_id/items/bulk-update', async (req, res, next) => {
  try {
    await shoppingListController.bulkUpdateItems(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /shopping-list/{family_group_id}/items/bulk-delete:
 *   post:
 *     summary: Bulk delete shopping list items
 *     description: Soft deletes one or more shopping list items in a single request
 *     tags:
 *       - Shopping List
 *     parameters:
 *       - name: family_group_id
 *         in: path
 *         required: true
 *         description: The id of the family group
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: The ids of the items to delete
 *     responses:
 *       200:
 *         description: The deleted items
 *       400:
 *         description: Validation error
 *       404:
 *         description: Item not found
 *       500:
 *         description: Failed to delete items
 */
router.post('/:family_group_id/items/bulk-delete', async (req, res, next) => {
  try {
    await shoppingListController.bulkDeleteItems(req, res);
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
 *       description: At least one of name, checked or category must be provided (partial updates supported)
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               name:
 *                 type: string
 *                 description: The new name of the item
 *               checked:
 *                 type: boolean
 *                 description: Whether the item is checked
 *               category:
 *                 type: string
 *                 enum: [meat, fruit_veg, bakery, canned, other]
 *                 description: Move the item to this category
 *     responses:
 *       200:
 *         description: The updated item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingListItem'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     - Valid item ID is required
 *                     - Valid family group ID is required
 *                     - At least one of name or checked is required
 *                     - Name must be a non-empty string
 *                     - Checked status must be a boolean
 *       404:
 *         description: Item not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Item not found
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