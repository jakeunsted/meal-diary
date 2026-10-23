import { beforeEach, describe, expect, it, vi } from 'vitest';

const isGoustoRecipeUrl = vi.fn();
const parseGoustoRecipeFromUrl = vi.fn();
const fetchAndParseSchemaOrgRecipe = vi.fn();

vi.mock('../gousto.adapter.ts', () => ({
  isGoustoRecipeUrl: (...args: unknown[]) => isGoustoRecipeUrl(...args),
  parseGoustoRecipeFromUrl: (...args: unknown[]) => parseGoustoRecipeFromUrl(...args),
}));

vi.mock('../schemaOrg.parser.ts', () => ({
  fetchAndParseSchemaOrgRecipe: (...args: unknown[]) => fetchAndParseSchemaOrgRecipe(...args),
}));

import { InvalidRecipeImportUrlError } from '../errors.ts';
import { normalizeRecipeImportUrl, parseRecipeFromUrl } from '../parseRecipeFromUrl.ts';

const draft = { name: 'Soup', ingredients: [] };

describe('normalizeRecipeImportUrl', () => {
  it('accepts http and https and trims whitespace', () => {
    expect(normalizeRecipeImportUrl('  https://example.com/soup  ').href).toBe('https://example.com/soup');
    expect(normalizeRecipeImportUrl('http://example.com/soup').protocol).toBe('http:');
  });

  it('rejects non-http protocols and blank input', () => {
    expect(() => normalizeRecipeImportUrl('javascript:alert(1)')).toThrow(InvalidRecipeImportUrlError);
    expect(() => normalizeRecipeImportUrl('   ')).toThrow(InvalidRecipeImportUrlError);
    expect(() => normalizeRecipeImportUrl('not a url')).toThrow(InvalidRecipeImportUrlError);
  });
});

describe('parseRecipeFromUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends Gousto URLs to the Gousto adapter', async () => {
    isGoustoRecipeUrl.mockReturnValue(true);
    parseGoustoRecipeFromUrl.mockResolvedValue(draft);
    const fetchImpl = vi.fn();

    await expect(parseRecipeFromUrl('https://www.gousto.co.uk/cookbook/recipes/soup', fetchImpl)).resolves.toBe(draft);

    expect(parseGoustoRecipeFromUrl).toHaveBeenCalledWith(expect.any(URL), fetchImpl);
    expect(fetchAndParseSchemaOrgRecipe).not.toHaveBeenCalled();
  });

  it('sends other URLs to the schema.org parser', async () => {
    isGoustoRecipeUrl.mockReturnValue(false);
    fetchAndParseSchemaOrgRecipe.mockResolvedValue(draft);

    await expect(parseRecipeFromUrl('https://example.com/soup')).resolves.toBe(draft);

    expect(fetchAndParseSchemaOrgRecipe).toHaveBeenCalledWith(expect.any(URL));
    expect(parseGoustoRecipeFromUrl).not.toHaveBeenCalled();
  });
});
