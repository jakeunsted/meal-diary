import express from 'express';
import * as recipeController from '../controllers/recipe/recipe.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     RecipeIngredient:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *           maxLength: 200
 *         quantity:
 *           type: number
 *           nullable: true
 *         unit:
 *           type: string
 *           maxLength: 50
 *           nullable: true
 *     Recipe:
 *       type: object
 *       required:
 *         - family_group_id
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *         family_group_id:
 *           type: integer
 *         created_by:
 *           type: integer
 *         name:
 *           type: string
 *           maxLength: 200
 *         description:
 *           type: string
 *           nullable: true
 *         instructions:
 *           type: string
 *           nullable: true
 *         portions:
 *           type: integer
 *           nullable: true
 *         ingredients:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RecipeIngredient'
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /recipes/family/{family_group_id}:
 *   get:
 *     summary: Get all recipes for a family group
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: family_group_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The family group ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search recipes by name
 *     responses:
 *       200:
 *         description: List of recipes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Recipe'
 *       400:
 *         description: Family group ID is required
 *       500:
 *         description: Failed to get recipes
 */
router.get('/family/:family_group_id', authenticateToken, async (req, res, next) => {
  try {
    await recipeController.getRecipes(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /recipes/{id}:
 *   get:
 *     summary: Get a recipe by ID
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The recipe ID
 *     responses:
 *       200:
 *         description: The recipe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Recipe'
 *       404:
 *         description: Recipe not found
 *       500:
 *         description: Failed to get recipe
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    await recipeController.getRecipeById(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /recipes:
 *   post:
 *     summary: Create a new recipe
 *     tags: [Recipes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - family_group_id
 *               - name
 *             properties:
 *               family_group_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               instructions:
 *                 type: string
 *               portions:
 *                 type: integer
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *     responses:
 *       201:
 *         description: The created recipe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Recipe'
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Failed to create recipe
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    await recipeController.createRecipe(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /recipes/{id}:
 *   put:
 *     summary: Update a recipe
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The recipe ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               instructions:
 *                 type: string
 *               portions:
 *                 type: integer
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *     responses:
 *       200:
 *         description: The updated recipe
 *       404:
 *         description: Recipe not found
 *       500:
 *         description: Failed to update recipe
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    await recipeController.updateRecipe(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /recipes/{id}:
 *   delete:
 *     summary: Delete a recipe
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The recipe ID
 *     responses:
 *       200:
 *         description: Recipe deleted successfully
 *       404:
 *         description: Recipe not found
 *       500:
 *         description: Failed to delete recipe
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    await recipeController.deleteRecipe(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
