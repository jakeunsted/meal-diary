import express from 'express';
import * as itemCategoriesController from '../controllers/item-categories/itemCategories.controller.ts';

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
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
 */

/**
 * @openapi
 * /item-categories:
 *   get:
 *     summary: Get all item categories
 *     description: Retrieve a list of all item categories
 *     tags:
 *       - Item Categories
 *     responses:
 *       200:
 *         description: A list of item categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ItemCategory'
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res, next) => {
  try {
    await itemCategoriesController.getAllItemCategories(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /item-categories/{id}:
 *   get:
 *     summary: Get an item category by ID
 *     description: Retrieve a specific item category by its ID
 *     tags:
 *       - Item Categories
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the item category
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: The item category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ItemCategory'
 *       404:
 *         description: Item category not found
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req, res, next) => {
  try {
    await itemCategoriesController.getItemCategoryById(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /item-categories:
 *   post:
 *     summary: Create a new item category
 *     description: Create a new item category with the provided data
 *     tags:
 *       - Item Categories
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
 *                 description: The name of the category
 *               icon:
 *                 type: string
 *                 description: The icon identifier for the category
 *     responses:
 *       201:
 *         description: The created item category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ItemCategory'
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res, next) => {
  try {
    await itemCategoriesController.createItemCategory(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /item-categories/{id}:
 *   put:
 *     summary: Update an item category
 *     description: Update an existing item category by its ID
 *     tags:
 *       - Item Categories
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the item category
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the category
 *               icon:
 *                 type: string
 *                 description: The icon identifier for the category
 *     responses:
 *       200:
 *         description: The updated item category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ItemCategory'
 *       404:
 *         description: Item category not found
 *       500:
 *         description: Server error
 */
router.put('/:id', async (req, res, next) => {
  try {
    await itemCategoriesController.updateItemCategory(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /item-categories/{id}:
 *   delete:
 *     summary: Delete an item category
 *     description: Delete an item category by its ID
 *     tags:
 *       - Item Categories
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the item category
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Item category deleted successfully
 *       404:
 *         description: Item category not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await itemCategoriesController.deleteItemCategory(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
