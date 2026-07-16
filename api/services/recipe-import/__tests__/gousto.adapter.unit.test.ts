import { describe, expect, it, vi } from 'vitest';

import {
  extractGoustoRecipeSlug,
  isGoustoRecipeUrl,
  mapGoustoApiResponse,
  parseGoustoIngredientLabel,
  parseGoustoRecipeFromUrl,
} from '../gousto.adapter.ts';
import { UnsupportedRecipeImportSiteError } from '../errors.ts';
import { parseRecipeFromUrl } from '../parseRecipeFromUrl.ts';

describe('recipe-import/gousto.adapter', () => {
  it('detects Gousto recipe urls', () => {
    expect(isGoustoRecipeUrl(new URL('https://www.gousto.co.uk/cookbook/recipes/truffle-cacio-e-pepe'))).toBe(true);
    expect(isGoustoRecipeUrl(new URL('https://example.com/recipe'))).toBe(false);
  });

  it('extracts the recipe slug from Gousto urls', () => {
    expect(
      extractGoustoRecipeSlug(
        new URL('https://www.gousto.co.uk/cookbook/recipes/truffle-cacio-e-pepe-sauce-with-spinach-ricotta-ravioli')
      )
    ).toBe('truffle-cacio-e-pepe-sauce-with-spinach-ricotta-ravioli');

    expect(
      extractGoustoRecipeSlug(
        new URL('https://www.gousto.co.uk/cookbook/chicken-recipes/sicilian-chicken-red-pepper-linguine')
      )
    ).toBe('sicilian-chicken-red-pepper-linguine');
  });

  it('parses quantity and unit from Gousto ingredient labels', () => {
    expect(parseGoustoIngredientLabel('Cornish clotted cream (40g)')).toEqual({
      name: 'Cornish clotted cream',
      quantity: 40,
      unit: 'g',
    });
    expect(parseGoustoIngredientLabel('Cracked black pepper (2.5g)')).toEqual({
      name: 'Cracked black pepper',
      quantity: 2.5,
      unit: 'g',
    });
    expect(parseGoustoIngredientLabel('Grated Italian hard cheese (30g) x2')).toEqual({
      name: 'Grated Italian hard cheese',
      quantity: 60,
      unit: 'g',
    });
    expect(parseGoustoIngredientLabel('Pepper')).toEqual({
      name: 'Pepper',
    });
  });

  it('maps Gousto API payloads into the internal draft shape', () => {
    const draft = mapGoustoApiResponse({
      data: [{
        attributes: {
          name: 'Cacio E Pepe Sauce With Spinach & Ricotta Ravioli',
          description: 'A speedy cheese and pepper sauce.',
          basics: [{ name: 'Salt' }, { name: 'Pepper' }],
          steps: [
            { number: 2, instruction: '<p>Cook the ravioli</p>' },
            { number: 1, instruction: '<p>Boil the water</p>' },
          ],
        },
        relationships: {
          ingredients: {
            data: [
              {
                id: '1',
                type: 'ingredient',
                labels: {
                  for2: 'Spinach & ricotta ravioli (250g)',
                  for4: 'Spinach & ricotta ravioli (250g) x2',
                },
              },
            ],
          },
        },
      }],
    });

    expect(draft).toEqual({
      name: 'Cacio E Pepe Sauce With Spinach & Ricotta Ravioli',
      description: 'A speedy cheese and pepper sauce.',
      instructions: '1. Boil the water\n\n2. Cook the ravioli',
      portions: 2,
      ingredients: [
        { name: 'Spinach & ricotta ravioli', quantity: 250, unit: 'g' },
        { name: 'Salt' },
        { name: 'Pepper' },
      ],
    });
  });

  it('throws unsupported when the Gousto API request fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(
      parseGoustoRecipeFromUrl(
        new URL('https://www.gousto.co.uk/cookbook/recipes/truffle-cacio-e-pepe'),
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toBeInstanceOf(UnsupportedRecipeImportSiteError);
  });

  it('routes Gousto urls through the Gousto adapter', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{
          attributes: {
            name: 'Imported Gousto recipe',
            description: 'From Gousto API',
            basics: [],
            steps: [{ number: 1, instruction: '<p>Cook</p>' }],
          },
          relationships: {
            ingredients: {
              data: [{
                id: '1',
                type: 'ingredient',
                labels: { for2: 'Ravioli (250g)' },
              }],
            },
          },
        }],
      }),
    });

    const draft = await parseRecipeFromUrl(
      'https://www.gousto.co.uk/cookbook/recipes/truffle-cacio-e-pepe',
      fetchImpl as unknown as typeof fetch
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://production-api.gousto.co.uk/cookbook/v1/recipes/truffle-cacio-e-pepe',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    );
    expect(draft.name).toBe('Imported Gousto recipe');
    expect(draft.ingredients).toEqual([{ name: 'Ravioli', quantity: 250, unit: 'g' }]);
  });

  it('routes category Gousto urls through the Gousto adapter', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{
          attributes: {
            name: 'Sicilian Chicken Red Pepper Linguine',
            description: 'From Gousto API',
            basics: [],
            steps: [{ number: 1, instruction: '<p>Cook</p>' }],
          },
          relationships: {
            ingredients: {
              data: [{
                id: '1',
                type: 'ingredient',
                labels: { for2: 'Chicken (320g)' },
              }],
            },
          },
        }],
      }),
    });

    const draft = await parseRecipeFromUrl(
      'https://www.gousto.co.uk/cookbook/chicken-recipes/sicilian-chicken-red-pepper-linguine',
      fetchImpl as unknown as typeof fetch
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://production-api.gousto.co.uk/cookbook/v1/recipes/sicilian-chicken-red-pepper-linguine',
      expect.any(Object)
    );
    expect(draft.name).toBe('Sicilian Chicken Red Pepper Linguine');
  });
});
