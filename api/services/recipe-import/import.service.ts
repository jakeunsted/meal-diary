import { createRecipe } from '../recipe.service.ts';
import { parseRecipeFromUrl } from './parseRecipeFromUrl.ts';
import type { ParsedRecipeDraft } from './types.ts';

interface ImportRecipeFromUrlInput {
  family_group_id: number;
  created_by: number;
  url: string;
}

const mapImportedRecipeToCreatePayload = (
  importedRecipe: ParsedRecipeDraft,
  input: ImportRecipeFromUrlInput
) => ({
  family_group_id: input.family_group_id,
  created_by: input.created_by,
  name: importedRecipe.name,
  description: importedRecipe.description,
  instructions: importedRecipe.instructions,
  portions: importedRecipe.portions,
  ingredients: importedRecipe.ingredients.map((ingredient) => ({
    name: ingredient.name,
    quantity: ingredient.quantity ?? undefined,
    unit: ingredient.unit ?? undefined,
  })),
});

export const importRecipeFromUrl = async (input: ImportRecipeFromUrlInput) => {
  const importedRecipe = await parseRecipeFromUrl(input.url);

  return createRecipe(mapImportedRecipeToCreatePayload(importedRecipe, input));
};
