import type { Request, Response } from 'express';
import { User } from '../../db/models/associations.ts';
import { handleEntitlementError } from '../../middleware/entitlement.middleware.ts';
import {
  DefaultCategoryLockedError,
  RecipeCategoryNameError,
  RecipeCategoryNotFoundError,
  createRecipeCategory,
  deleteRecipeCategory,
  listRecipeCategories,
  renameRecipeCategory,
} from '../../services/recipeCategories.service.ts';
import { routeParamInt } from '../../utils/routeParam.ts';

const handleRecipeCategoryError = (error: unknown, res: Response): boolean => {
  if (handleEntitlementError(error, res)) {
    return true;
  }
  if (error instanceof RecipeCategoryNameError || error instanceof DefaultCategoryLockedError) {
    res.status(400).json({ code: error.code, message: error.message });
    return true;
  }
  if (error instanceof RecipeCategoryNotFoundError) {
    res.status(404).json({ message: error.message });
    return true;
  }
  return false;
};

const familyGroupIdFromRequest = (req: Request, res: Response): number | null => {
  const familyGroupId = routeParamInt(req.params.family_group_id);
  if (!familyGroupId || Number.isNaN(familyGroupId)) {
    res.status(400).json({ message: 'Invalid family group id' });
    return null;
  }
  return familyGroupId;
};

const requestingUserId = (req: Request): number => (req.user as User).dataValues.id;

export const getRecipeCategories = async (req: Request, res: Response) => {
  try {
    const familyGroupId = familyGroupIdFromRequest(req, res);
    if (familyGroupId == null) {
      return;
    }

    const categories = await listRecipeCategories(familyGroupId, requestingUserId(req));
    return res.status(200).json({ categories });
  } catch (error) {
    console.error('Error getting recipe categories:', error);
    return res.status(500).json({ message: 'Failed to get recipe categories' });
  }
};

export const postRecipeCategory = async (req: Request, res: Response) => {
  try {
    const familyGroupId = familyGroupIdFromRequest(req, res);
    if (familyGroupId == null) {
      return;
    }

    const category = await createRecipeCategory(
      familyGroupId,
      requestingUserId(req),
      req.body?.name
    );
    return res.status(201).json({ category });
  } catch (error) {
    if (handleRecipeCategoryError(error, res)) {
      return;
    }
    console.error('Error creating recipe category:', error);
    return res.status(500).json({ message: 'Failed to create recipe category' });
  }
};

export const patchRecipeCategory = async (req: Request, res: Response) => {
  try {
    const familyGroupId = familyGroupIdFromRequest(req, res);
    if (familyGroupId == null) {
      return;
    }
    const categoryId = routeParamInt(req.params.category_id);
    if (!categoryId || Number.isNaN(categoryId)) {
      return res.status(400).json({ message: 'Invalid category id' });
    }

    const category = await renameRecipeCategory(
      familyGroupId,
      requestingUserId(req),
      categoryId,
      req.body?.name
    );
    return res.status(200).json({ category });
  } catch (error) {
    if (handleRecipeCategoryError(error, res)) {
      return;
    }
    console.error('Error renaming recipe category:', error);
    return res.status(500).json({ message: 'Failed to rename recipe category' });
  }
};

export const deleteRecipeCategoryById = async (req: Request, res: Response) => {
  try {
    const familyGroupId = familyGroupIdFromRequest(req, res);
    if (familyGroupId == null) {
      return;
    }
    const categoryId = routeParamInt(req.params.category_id);
    if (!categoryId || Number.isNaN(categoryId)) {
      return res.status(400).json({ message: 'Invalid category id' });
    }

    await deleteRecipeCategory(familyGroupId, requestingUserId(req), categoryId);
    return res.status(204).end();
  } catch (error) {
    if (handleRecipeCategoryError(error, res)) {
      return;
    }
    console.error('Error deleting recipe category:', error);
    return res.status(500).json({ message: 'Failed to delete recipe category' });
  }
};
