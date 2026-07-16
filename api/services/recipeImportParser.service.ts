export interface ParsedRecipeIngredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

export interface ParsedRecipeDraft {
  name: string;
  description?: string;
  instructions?: string;
  portions?: number;
  ingredients: ParsedRecipeIngredient[];
}

export class InvalidRecipeImportUrlError extends Error {
  constructor(message = 'Invalid recipe URL') {
    super(message);
    this.name = 'InvalidRecipeImportUrlError';
  }
}

export class RecipeImportParseError extends Error {
  constructor(message = 'Failed to parse recipe from URL') {
    super(message);
    this.name = 'RecipeImportParseError';
  }
}

const commonUnits = new Set([
  'tsp',
  'teaspoon',
  'teaspoons',
  'tbsp',
  'tablespoon',
  'tablespoons',
  'cup',
  'cups',
  'g',
  'kg',
  'ml',
  'l',
  'oz',
  'lb',
  'lbs',
  'clove',
  'cloves',
  'slice',
  'slices',
  'can',
  'cans',
  'tin',
  'tins',
  'pinch',
  'pinches',
  'sprig',
  'sprigs',
  'bunch',
  'bunches',
  'packet',
  'packets',
]);

const jsonLdScriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const sanitizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const normalizeInstructionStep = (value: unknown): string[] => {
  if (typeof value === 'string') {
    const normalized = sanitizeWhitespace(value);
    return normalized ? [normalized] : [];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const item = value as Record<string, unknown>;

  if (typeof item.text === 'string') {
    const normalized = sanitizeWhitespace(item.text);
    return normalized ? [normalized] : [];
  }

  if (typeof item.name === 'string') {
    const normalized = sanitizeWhitespace(item.name);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(item.itemListElement)) {
    return item.itemListElement.flatMap(normalizeInstructionStep);
  }

  return [];
};

const parseFraction = (value: string): number | null => {
  if (!value.includes('/')) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const [numerator, denominator] = value.split('/');
  const parsedNumerator = Number.parseFloat(numerator);
  const parsedDenominator = Number.parseFloat(denominator);

  if (!Number.isFinite(parsedNumerator) || !Number.isFinite(parsedDenominator) || parsedDenominator === 0) {
    return null;
  }

  return parsedNumerator / parsedDenominator;
};

const parseQuantityToken = (value: string): number | null => {
  const parts = value.trim().split(/\s+/);
  const parsedParts = parts.map(parseFraction);

  if (parsedParts.some((part) => part == null)) {
    return null;
  }

  return parsedParts.reduce<number>((sum, part) => sum + (part ?? 0), 0);
};

const parseIngredientText = (value: string): ParsedRecipeIngredient => {
  const trimmed = sanitizeWhitespace(value);
  const parts = trimmed.split(' ');
  const quantityParts: string[] = [];

  while (parts.length > 0) {
    const candidate = [...quantityParts, parts[0]].join(' ').trim();
    const parsed = parseQuantityToken(candidate);

    if (parsed == null) {
      break;
    }

    quantityParts.push(parts.shift() as string);
  }

  const quantity = quantityParts.length > 0 ? parseQuantityToken(quantityParts.join(' ')) : null;
  const nextPart = parts[0]?.toLowerCase().replace(/[.,]$/, '');
  const hasUnit = nextPart ? commonUnits.has(nextPart) : false;
  const unit = hasUnit ? sanitizeWhitespace(parts.shift() as string) : null;
  const name = sanitizeWhitespace(parts.join(' ')) || trimmed;

  return {
    name,
    quantity,
    unit,
  };
};

const parsePortions = (value: unknown): number | undefined => {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate !== 'string') {
    return undefined;
  }

  const match = candidate.match(/\d+/);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const extractJsonLdNodes = (html: string): unknown[] => {
  const nodes: unknown[] = [];

  for (const match of html.matchAll(jsonLdScriptPattern)) {
    const rawJson = match[1]?.trim();

    if (!rawJson) {
      continue;
    }

    try {
      nodes.push(JSON.parse(rawJson));
    } catch {
      continue;
    }
  }

  return nodes;
};

const flattenJsonLdNodes = (node: unknown): Record<string, unknown>[] => {
  if (Array.isArray(node)) {
    return node.flatMap(flattenJsonLdNodes);
  }

  if (!node || typeof node !== 'object') {
    return [];
  }

  const record = node as Record<string, unknown>;
  const graphNodes = Array.isArray(record['@graph']) ? record['@graph'].flatMap(flattenJsonLdNodes) : [];

  return [record, ...graphNodes];
};

const isRecipeNode = (node: Record<string, unknown>): boolean => {
  const nodeType = node['@type'];

  if (typeof nodeType === 'string') {
    return nodeType.toLowerCase() === 'recipe';
  }

  if (Array.isArray(nodeType)) {
    return nodeType.some((value) => typeof value === 'string' && value.toLowerCase() === 'recipe');
  }

  return false;
};

export const normalizeRecipeImportUrl = (value: string): string => {
  try {
    const url = new URL(value.trim());

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new InvalidRecipeImportUrlError();
    }

    return url.toString();
  } catch {
    throw new InvalidRecipeImportUrlError();
  }
};

export const parseRecipeFromHtml = (html: string): ParsedRecipeDraft => {
  const recipeNode = extractJsonLdNodes(html)
    .flatMap(flattenJsonLdNodes)
    .find(isRecipeNode);

  if (!recipeNode) {
    throw new RecipeImportParseError('Recipe schema not found on page');
  }

  const name = typeof recipeNode.name === 'string' ? sanitizeWhitespace(recipeNode.name) : '';
  if (!name) {
    throw new RecipeImportParseError('Recipe name not found on page');
  }

  const description = typeof recipeNode.description === 'string'
    ? sanitizeWhitespace(recipeNode.description)
    : undefined;

  const instructionsSource = recipeNode.recipeInstructions;
  const instructions = Array.isArray(instructionsSource)
    ? instructionsSource.flatMap(normalizeInstructionStep).join('\n\n')
    : normalizeInstructionStep(instructionsSource).join('\n\n');

  const ingredientSource = Array.isArray(recipeNode.recipeIngredient) ? recipeNode.recipeIngredient : [];
  const ingredients = ingredientSource
    .filter((ingredient): ingredient is string => typeof ingredient === 'string')
    .map(parseIngredientText);

  return {
    name,
    description: description || undefined,
    instructions: instructions || undefined,
    portions: parsePortions(recipeNode.recipeYield),
    ingredients,
  };
};

export const parseRecipeFromUrl = async (
  value: string,
  fetchImpl: typeof fetch = fetch
): Promise<ParsedRecipeDraft> => {
  const normalizedUrl = normalizeRecipeImportUrl(value);
  const response = await fetchImpl(normalizedUrl, {
    headers: {
      'User-Agent': 'MealDiaryRecipeImporter/1.0',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new RecipeImportParseError(`Failed to fetch recipe page (${response.status})`);
  }

  const html = await response.text();
  return parseRecipeFromHtml(html);
};
