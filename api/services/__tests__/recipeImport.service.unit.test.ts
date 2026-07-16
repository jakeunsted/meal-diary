import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../recipe.service.ts', () => ({
  createRecipe: vi.fn(),
}));

vi.mock('../recipeImportParser.service.ts', () => ({
  parseRecipeFromUrl: vi.fn(),
}));

import { createRecipe } from '../recipe.service.ts';
import { parseRecipeFromUrl } from '../recipeImportParser.service.ts';
import { importRecipeFromUrl } from '../recipeImport.service.ts';

describe('recipeImport.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps parsed recipe data into createRecipe', async () => {
    vi.mocked(parseRecipeFromUrl).mockResolvedValue({
      name: 'Imported curry',
      description: 'Weeknight dinner',
      instructions: 'Cook.\n\nServe.',
      portions: 4,
      ingredients: [
        { name: 'Onion', quantity: 1, unit: null },
        { name: 'Curry powder', quantity: 2, unit: 'tsp' },
      ],
    });
    vi.mocked(createRecipe).mockResolvedValue({ id: 42 } as never);

    const result = await importRecipeFromUrl({
      family_group_id: 7,
      created_by: 3,
      url: 'https://example.com/curry',
    });

    expect(parseRecipeFromUrl).toHaveBeenCalledWith('https://example.com/curry');
    expect(createRecipe).toHaveBeenCalledWith({
      family_group_id: 7,
      created_by: 3,
      name: 'Imported curry',
      description: 'Weeknight dinner',
      instructions: 'Cook.\n\nServe.',
      portions: 4,
      ingredients: [
        { name: 'Onion', quantity: 1, unit: undefined },
        { name: 'Curry powder', quantity: 2, unit: 'tsp' },
      ],
    });
    expect(result).toEqual({ id: 42 });
  });

  it('propagates parser failures without creating a recipe', async () => {
    vi.mocked(parseRecipeFromUrl).mockRejectedValue(new Error('parse failed'));

    await expect(importRecipeFromUrl({
      family_group_id: 7,
      created_by: 3,
      url: 'https://example.com/curry',
    })).rejects.toThrow('parse failed');

    expect(createRecipe).not.toHaveBeenCalled();
  });
});
