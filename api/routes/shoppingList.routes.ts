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
 *         - content
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the shopping list
 *         family_group_id:
 *           type: integer
 *           description: The id of the family group the shopping list belongs to
 *         content:
 *           type: object
 *           description: The contents of the shopping list. This is JSONB and is dynamic to the users preferences.
 *           properties:
 *             categories:
 *               type: array
 *               description: The categories in the shopping list
 *               items:
 *                 type: object
 *                 description: The items in the shopping list
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: The name of the item
 *                   checked:
 *                     type: boolean
 *                     description: Whether the item has been checked off
 *         created_at:  
 *           type: string
 *           format: date-time
 *           description: The date and time the shopping list was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the shopping list was last updated
 * 
 *     ShoppingListContent:
 *       type: object
 *       required:
 *         - categories
 *       properties:
 *         categories:
 *           type: array
 *           description: The categories in the shopping list
 *           items:
 *             $ref: '#/components/schemas/ShoppingListCategory'
 *     
 *     ShoppingListCategory:
 *       type: object
 *       required:
 *         - name
 *         - items
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the category
 *         items:
 *           type: array
 *           description: The items in the category
 *           items:
 *             $ref: '#/components/schemas/ShoppingListItem'
 * 
 *     ShoppingListItem:
 *       type: object
 *       required:
 *         - name
 *         - checked
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the item
 *         checked:
 *           type: boolean
 *           description: Whether the item has been checked off
 */

/**
 * @openapi
 * /api/shopping-list:
 *   get:
 *     summary: Get the entire shopping list
 *     description: Retrieves all shopping lists
 *     tags:
 *       - Shopping List
 *     responses:
 *       200:
 *         description: A list of shopping lists
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ShoppingList'
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res, next) => {
  try {
    await shoppingListController.getEntireShoppingList(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/shopping-list/new-category:
 *   post:
 *     summary: Add a new category to a shopping list
 *     description: Creates a new empty category in the shopping list
 *     tags:
 *       - Shopping List
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - family_group_id
 *               - category_name
 *             properties:
 *               family_group_id:
 *                 type: integer
 *                 description: The ID of the family group
 *               category_name:
 *                 type: string
 *                 description: The name of the new category
 *     responses:
 *       200:
 *         description: The newly created category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingListCategory'
 *       500:
 *         description: Failed to add new category
 */
router.post('/new-category', async (req, res, next) => {
  try {
    await shoppingListController.addCategory(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/shopping-list/save-category:
 *   post:
 *     summary: Save a category in the shopping list
 *     description: Replaces a category's contents with new values
 *     tags:
 *       - Shopping List
 *     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             required:
*               - family_group_id
*               - category_name
*               - category_contents
*             properties:
*               family_group_id:
*                 type: integer
*                 description: The ID of the family group
*               category_name:
*                 type: string
*                 description: The name of the category to update
*               category_contents:
*                 $ref: '#/components/schemas/ShoppingListCategory'
*     responses:
*       200:
*         description: The updated category
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ShoppingListCategory'
*       500:
*         description: Failed to save category
*/
router.post('/save-category', async (req, res, next) => {
  try {
    await shoppingListController.saveCategory(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;