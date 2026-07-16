import { describe, expect, it } from 'vitest';

import {
  InvalidRecipeImportUrlError,
  parseRecipeFromHtml,
  parseRecipeFromUrl,
  RecipeImportParseError,
} from '../recipeImportParser.service.ts';

describe('recipeImportParser.service', () => {
  it('maps recipe schema into the internal draft shape', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Tomato Pasta",
              "description": "Fast dinner",
              "recipeYield": "Serves 4",
              "recipeIngredient": ["1 onion", "2 tsp olive oil", "400 g tomatoes"],
              "recipeInstructions": [
                { "@type": "HowToStep", "text": "Chop the onion" },
                { "@type": "HowToStep", "text": "Cook everything together" }
              ]
            }
          </script>
        </head>
      </html>
    `;

    expect(parseRecipeFromHtml(html)).toEqual({
      name: 'Tomato Pasta',
      description: 'Fast dinner',
      instructions: 'Chop the onion\n\nCook everything together',
      portions: 4,
      ingredients: [
        { name: 'onion', quantity: 1, unit: null },
        { name: 'olive oil', quantity: 2, unit: 'tsp' },
        { name: 'tomatoes', quantity: 400, unit: 'g' },
      ],
    });
  });

  it('handles missing optional fields gracefully', () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Recipe",
              "name": "Toast"
            }
          ]
        }
      </script>
    `;

    expect(parseRecipeFromHtml(html)).toEqual({
      name: 'Toast',
      description: undefined,
      instructions: undefined,
      portions: undefined,
      ingredients: [],
    });
  });

  it('rejects malformed urls', async () => {
    await expect(parseRecipeFromUrl('not-a-url')).rejects.toBeInstanceOf(InvalidRecipeImportUrlError);
  });

  it('rejects pages without recipe schema', () => {
    expect(() => parseRecipeFromHtml('<html><body>No schema here</body></html>'))
      .toThrow(RecipeImportParseError);
  });
});
