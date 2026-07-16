import {
  InvalidRecipeImportUrlError,
  RecipeImportParseError,
  UnsupportedRecipeImportSiteError,
} from './errors.ts';
import { isGoustoRecipeUrl, parseGoustoRecipeFromUrl } from './gousto.adapter.ts';
import { fetchAndParseSchemaOrgRecipe } from './schemaOrg.parser.ts';
import type { ParsedRecipeDraft } from './types.ts';

export {
  InvalidRecipeImportUrlError,
  RecipeImportParseError,
  UnsupportedRecipeImportSiteError,
};
export type { ParsedRecipeDraft, ParsedRecipeIngredient } from './types.ts';

export const normalizeRecipeImportUrl = (value: string): URL => {
  try {
    const url = new URL(value.trim());

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new InvalidRecipeImportUrlError();
    }

    return url;
  } catch (error) {
    if (error instanceof InvalidRecipeImportUrlError) {
      throw error;
    }

    throw new InvalidRecipeImportUrlError();
  }
};

export const parseRecipeFromUrl = async (
  value: string,
  fetchImpl: typeof fetch = fetch
): Promise<ParsedRecipeDraft> => {
  const url = normalizeRecipeImportUrl(value);

  if (isGoustoRecipeUrl(url)) {
    return parseGoustoRecipeFromUrl(url, fetchImpl);
  }

  return fetchAndParseSchemaOrgRecipe(url.toString(), fetchImpl);
};
