import { UnsupportedRecipeImportSiteError } from './errors.ts';
import type { ParsedRecipeDraft, ParsedRecipeIngredient } from './types.ts';

const GOUSTO_HOST_SUFFIX = 'gousto.co.uk';
const GOUSTO_RECIPE_API = 'https://production-api.gousto.co.uk/cookbook/v1/recipes';
const DEFAULT_PORTIONS = 2;

interface GoustoIngredientRef {
  id: string;
  type: string;
  labels?: Record<string, string>;
  quantities?: Record<string, number>;
}

interface GoustoBasic {
  name?: string;
}

interface GoustoStep {
  number?: number;
  instruction?: string;
}

interface GoustoRecipeAttributes {
  name?: string;
  description?: string;
  basics?: GoustoBasic[];
  steps?: GoustoStep[];
}

interface GoustoRecipeResponse {
  data?: Array<{
    attributes?: GoustoRecipeAttributes;
    relationships?: {
      ingredients?: {
        data?: GoustoIngredientRef[];
      };
    };
  }>;
}

export const isGoustoRecipeUrl = (url: URL): boolean => {
  const host = url.hostname.toLowerCase();
  return host === GOUSTO_HOST_SUFFIX || host.endsWith(`.${GOUSTO_HOST_SUFFIX}`);
};

export const extractGoustoRecipeSlug = (url: URL): string | null => {
  // /cookbook/recipes/{slug} and /cookbook/{category}/{slug} (e.g. chicken-recipes)
  const match = url.pathname.match(/\/cookbook\/(?:[^/]+\/)+([^/?#]+)\/?$/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// e.g. "Cornish clotted cream (40g)", "Cracked black pepper (2.5g) x2"
const goustoQuantityLabelPattern = /^(.+?)\s*\((\d+(?:\.\d+)?)\s*([a-zA-Z]+)\)(?:\s*x(\d+))?$/i;

export const parseGoustoIngredientLabel = (label: string): ParsedRecipeIngredient => {
  const trimmed = label.trim();
  const match = trimmed.match(goustoQuantityLabelPattern);

  if (!match) {
    return { name: trimmed };
  }

  const [, name, quantityText, unit, packCountText] = match;
  const packSize = Number.parseFloat(quantityText);
  const packCount = packCountText ? Number.parseInt(packCountText, 10) : 1;

  if (!Number.isFinite(packSize) || !Number.isFinite(packCount) || packCount < 1) {
    return { name: trimmed };
  }

  return {
    name: name.trim(),
    quantity: packSize * packCount,
    unit: unit.toLowerCase(),
  };
};

const mapGoustoIngredients = (
  refs: GoustoIngredientRef[],
  basics: GoustoBasic[],
  portionKey: string
): ParsedRecipeIngredient[] => {
  const boxed = refs
    .map((ref) => ref.labels?.[portionKey]?.trim())
    .filter((label): label is string => !!label)
    .map(parseGoustoIngredientLabel);

  const pantry = basics
    .map((basic) => basic.name?.trim())
    .filter((name): name is string => !!name)
    .map((name) => ({ name }));

  return [...boxed, ...pantry];
};

const mapGoustoInstructions = (steps: GoustoStep[]): string | undefined => {
  const lines = steps
    .slice()
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    .map((step) => {
      if (!step.instruction) {
        return null;
      }

      const text = stripHtml(step.instruction);
      if (!text) {
        return null;
      }

      return step.number != null ? `${step.number}. ${text}` : text;
    })
    .filter((line): line is string => !!line);

  return lines.length > 0 ? lines.join('\n\n') : undefined;
};

export const mapGoustoApiResponse = (payload: GoustoRecipeResponse): ParsedRecipeDraft => {
  const recipe = payload.data?.[0];
  const attributes = recipe?.attributes;
  const name = attributes?.name?.trim();

  if (!name) {
    throw new UnsupportedRecipeImportSiteError();
  }

  const portionKey = `for${DEFAULT_PORTIONS}`;
  const ingredientRefs = recipe?.relationships?.ingredients?.data ?? [];
  const basics = attributes?.basics ?? [];
  const steps = attributes?.steps ?? [];

  return {
    name,
    description: attributes?.description?.trim() || undefined,
    instructions: mapGoustoInstructions(steps),
    portions: DEFAULT_PORTIONS,
    ingredients: mapGoustoIngredients(ingredientRefs, basics, portionKey),
  };
};

export const parseGoustoRecipeFromUrl = async (
  url: URL,
  fetchImpl: typeof fetch = fetch
): Promise<ParsedRecipeDraft> => {
  const slug = extractGoustoRecipeSlug(url);

  if (!slug) {
    throw new UnsupportedRecipeImportSiteError();
  }

  try {
    const response = await fetchImpl(`${GOUSTO_RECIPE_API}/${encodeURIComponent(slug)}`, {
      headers: {
        'User-Agent': 'MealDiaryRecipeImporter/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new UnsupportedRecipeImportSiteError();
    }

    const payload = await response.json() as GoustoRecipeResponse;
    return mapGoustoApiResponse(payload);
  } catch (error) {
    if (error instanceof UnsupportedRecipeImportSiteError) {
      throw error;
    }

    throw new UnsupportedRecipeImportSiteError();
  }
};
