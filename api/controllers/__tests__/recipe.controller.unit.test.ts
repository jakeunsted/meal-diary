import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/recipe-import/import.service.ts', () => ({
  importRecipeFromUrl: vi.fn(),
}));

vi.mock('../../services/recipe.service.ts', () => ({
  getRecipesByFamilyGroup: vi.fn(),
  getRecipeById: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}));

vi.mock('../../services/entitlements.service.ts', async () => {
  const actual = await vi.importActual<typeof import('../../services/entitlements.service.ts')>(
    '../../services/entitlements.service.ts'
  );

  return {
    ...actual,
    assertCanCreateRecipe: vi.fn(),
  };
});

import * as EntitlementsService from '../../services/entitlements.service.ts';
import * as recipeImportService from '../../services/recipe-import/import.service.ts';
import * as recipeService from '../../services/recipe.service.ts';
import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  getRecipes,
  importRecipeFromUrl,
  updateRecipe,
} from '../recipe/recipe.controller.ts';
import {
  InvalidRecipeImportUrlError,
  RecipeImportParseError,
  UnsupportedRecipeImportSiteError,
} from '../../services/recipe-import/errors.ts';

const mockRequest = (body: Record<string, unknown>, familyGroupId = 10, userId = 5) =>
  ({
    body,
    user: {
      dataValues: {
        id: userId,
        family_group_id: familyGroupId,
      },
    },
  }) as unknown as Request;

const mockResponse = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

describe('recipe.controller importRecipeFromUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 201 with the created recipe', async () => {
    vi.mocked(EntitlementsService.assertCanCreateRecipe).mockResolvedValue({} as never);
    vi.mocked(recipeImportService.importRecipeFromUrl).mockResolvedValue({
      id: 99,
      name: 'Imported pasta',
    } as never);

    const req = mockRequest({
      family_group_id: 10,
      url: 'https://example.com/recipe',
    });
    const res = mockResponse();

    await importRecipeFromUrl(req, res);

    expect(EntitlementsService.assertCanCreateRecipe).toHaveBeenCalledWith(10, 5);
    expect(recipeImportService.importRecipeFromUrl).toHaveBeenCalledWith({
      family_group_id: 10,
      created_by: 5,
      url: 'https://example.com/recipe',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 99,
      name: 'Imported pasta',
    });
  });

  it('returns the recipe cap when the locked recount rejects the import', async () => {
    vi.mocked(EntitlementsService.assertCanCreateRecipe).mockResolvedValue({} as never);
    const error = new EntitlementsService.EntitlementRequiredError('recipes', 'free');
    vi.mocked(recipeImportService.importRecipeFromUrl).mockRejectedValue(error);

    const req = mockRequest({
      family_group_id: 10,
      url: 'https://example.com/recipe',
    });
    const res = mockResponse();

    await importRecipeFromUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'recipes',
    }));
  });

  it('returns 400 when family group id or url is missing', async () => {
    const req = mockRequest({ family_group_id: 10 });
    const res = mockResponse();

    await importRecipeFromUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Family group ID and URL are required',
    });
    expect(recipeImportService.importRecipeFromUrl).not.toHaveBeenCalled();
  });

  it('returns 403 when the user is not in the target family group', async () => {
    const req = mockRequest({
      family_group_id: 11,
      url: 'https://example.com/recipe',
    });
    const res = mockResponse();

    await importRecipeFromUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
    expect(recipeImportService.importRecipeFromUrl).not.toHaveBeenCalled();
  });

  it('returns entitlement errors as 403 responses', async () => {
    const error = new EntitlementsService.EntitlementRequiredError('recipes', 'premium');
    vi.mocked(EntitlementsService.assertCanCreateRecipe).mockRejectedValue(error);

    const req = mockRequest({
      family_group_id: 10,
      url: 'https://example.com/recipe',
    });
    const res = mockResponse();

    await importRecipeFromUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      code: error.code,
      feature: 'recipes',
      plan: 'premium',
      upgradeUrl: '/plans',
    });
  });

  it('returns 400 for invalid recipe urls', async () => {
    vi.mocked(EntitlementsService.assertCanCreateRecipe).mockResolvedValue({} as never);
    vi.mocked(recipeImportService.importRecipeFromUrl).mockRejectedValue(
      new InvalidRecipeImportUrlError()
    );

    const req = mockRequest({
      family_group_id: 10,
      url: 'not-a-url',
    });
    const res = mockResponse();

    await importRecipeFromUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid recipe URL' });
  });

  it('returns 422 when the page cannot be parsed into a recipe', async () => {
    vi.mocked(EntitlementsService.assertCanCreateRecipe).mockResolvedValue({} as never);
    vi.mocked(recipeImportService.importRecipeFromUrl).mockRejectedValue(
      new RecipeImportParseError('Recipe schema not found on page')
    );

    const req = mockRequest({
      family_group_id: 10,
      url: 'https://example.com/recipe',
    });
    const res = mockResponse();

    await importRecipeFromUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Recipe schema not found on page',
    });
  });

  it('returns 422 when a site-specific import is unsupported', async () => {
    vi.mocked(EntitlementsService.assertCanCreateRecipe).mockResolvedValue({} as never);
    vi.mocked(recipeImportService.importRecipeFromUrl).mockRejectedValue(
      new UnsupportedRecipeImportSiteError()
    );

    const req = mockRequest({
      family_group_id: 10,
      url: 'https://www.gousto.co.uk/cookbook/recipes/broken',
    });
    const res = mockResponse();

    await importRecipeFromUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      message: "This site isn't supported",
    });
  });

  it('returns 500 on unexpected failures', async () => {
    vi.mocked(EntitlementsService.assertCanCreateRecipe).mockResolvedValue({} as never);
    vi.mocked(recipeImportService.importRecipeFromUrl).mockRejectedValue(new Error('boom'));

    const req = mockRequest({
      family_group_id: 10,
      url: 'https://example.com/recipe',
    });
    const res = mockResponse();

    await importRecipeFromUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Failed to import recipe from URL',
    });
  });
});

describe('recipe.controller recipes', () => {
  const request = (
    params: Record<string, string> = {},
    body: Record<string, unknown> = {},
    query: Record<string, unknown> = {}
  ) =>
    ({
      params,
      body,
      query,
      user: { dataValues: { id: 5, family_group_id: 10 } },
    }) as unknown as Request;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists and reads recipes for the signed-in family', async () => {
    vi.mocked(recipeService.getRecipesByFamilyGroup).mockResolvedValue([{ id: 1 }] as never);
    const listed = mockResponse();
    await getRecipes(request({ family_group_id: '10' }, {}, { search: 'pasta' }), listed);
    expect(recipeService.getRecipesByFamilyGroup).toHaveBeenCalledWith(10, 'pasta', 5);
    expect(listed.status).toHaveBeenCalledWith(200);

    const missingFamily = mockResponse();
    await getRecipes(request(), missingFamily);
    expect(missingFamily.status).toHaveBeenCalledWith(400);

    vi.mocked(recipeService.getRecipeById).mockResolvedValue({
      dataValues: { family_group_id: 10 },
    } as never);
    const found = mockResponse();
    await getRecipeById(request({ id: '4' }), found);
    expect(found.status).toHaveBeenCalledWith(200);

    vi.mocked(recipeService.getRecipeById).mockResolvedValueOnce(null as never);
    const missing = mockResponse();
    await getRecipeById(request({ id: '4' }), missing);
    expect(missing.status).toHaveBeenCalledWith(404);

    vi.mocked(recipeService.getRecipeById).mockResolvedValueOnce({
      dataValues: { family_group_id: 99 },
    } as never);
    const forbidden = mockResponse();
    await getRecipeById(request({ id: '4' }), forbidden);
    expect(forbidden.status).toHaveBeenCalledWith(403);
  });

  it('creates, updates, and deletes a recipe in the signed-in family', async () => {
    vi.mocked(EntitlementsService.assertCanCreateRecipe).mockResolvedValue({} as never);
    vi.mocked(recipeService.createRecipe).mockResolvedValue({ id: 7 } as never);
    const created = mockResponse();
    await createRecipe(request({}, { family_group_id: '10', name: 'Pasta' }), created);
    expect(created.status).toHaveBeenCalledWith(201);

    const error = new EntitlementsService.EntitlementRequiredError('recipes', 'free');
    vi.mocked(recipeService.createRecipe).mockRejectedValueOnce(error);
    const capped = mockResponse();
    await createRecipe(request({}, { family_group_id: '10', name: 'Pasta' }), capped);
    expect(capped.status).toHaveBeenCalledWith(403);

    const incomplete = mockResponse();
    await createRecipe(request({}, { family_group_id: '10' }), incomplete);
    expect(incomplete.status).toHaveBeenCalledWith(400);

    const otherFamily = mockResponse();
    await createRecipe(request({}, { family_group_id: '11', name: 'Pasta' }), otherFamily);
    expect(otherFamily.status).toHaveBeenCalledWith(403);

    vi.mocked(recipeService.getRecipeById).mockResolvedValue({
      dataValues: { family_group_id: 10 },
    } as never);
    vi.mocked(recipeService.updateRecipe).mockResolvedValue({ id: 7, name: 'Pesto' } as never);
    const updated = mockResponse();
    await updateRecipe(request({ id: '7' }, { name: 'Pesto' }), updated);
    expect(updated.status).toHaveBeenCalledWith(200);

    vi.mocked(recipeService.deleteRecipe).mockResolvedValue(undefined as never);
    const deleted = mockResponse();
    await deleteRecipe(request({ id: '7' }), deleted);
    expect(deleted.json).toHaveBeenCalledWith({ message: 'Recipe deleted successfully' });
  });
});
