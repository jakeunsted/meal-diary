import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/recipe-import/import.service.ts', () => ({
  importRecipeFromUrl: vi.fn(),
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
import { importRecipeFromUrl } from '../recipe/recipe.controller.ts';
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
