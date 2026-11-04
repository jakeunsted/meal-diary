export interface RecipeSyncIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface RecipeSyncValue {
  name: string;
  description: string | null;
  instructions: string | null;
  portions: number | null;
  ingredients: RecipeSyncIngredient[];
  category_ids: number[];
}

export type RecipeSyncStatus = 'applied' | 'already_saved' | 'conflict' | 'not_found';

interface RecipeLike {
  name?: string | null;
  description?: string | null;
  instructions?: string | null;
  portions?: number | null;
  ingredients?: Array<{
    name?: string | null;
    quantity?: number | string | null;
    unit?: string | null;
  }>;
  categories?: Array<{ id?: number | null }>;
  category_ids?: number[] | null;
}

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeQuantity = (value: unknown): number | null => {
  if (value == null || value === '') {
    return null;
  }
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeCategoryIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids = value
    .map((item) => (typeof item === 'number' ? item : Number(item)))
    .filter((item) => Number.isInteger(item));
  return [...new Set(ids)].sort((left, right) => left - right);
};

const normalizeIngredients = (value: unknown): RecipeSyncIngredient[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const ingredients: RecipeSyncIngredient[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = normalizeText((item as { name?: unknown }).name);
    if (!name) {
      continue;
    }
    ingredients.push({
      name,
      quantity: normalizeQuantity((item as { quantity?: unknown }).quantity),
      unit: normalizeText((item as { unit?: unknown }).unit),
    });
  }
  return ingredients;
};

export const normalizeRecipeSyncValue = (value: RecipeSyncValue): RecipeSyncValue => ({
  name: normalizeText(value.name) ?? '',
  description: normalizeText(value.description),
  instructions: normalizeText(value.instructions),
  portions: normalizeQuantity(value.portions),
  ingredients: normalizeIngredients(value.ingredients),
  category_ids: normalizeCategoryIds(value.category_ids),
});

export const parseRecipeSyncValue = (input: unknown): RecipeSyncValue | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const record = input as Partial<RecipeSyncValue>;
  if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    return null;
  }
  if (record.ingredients != null && !Array.isArray(record.ingredients)) {
    return null;
  }
  if (record.category_ids != null && !Array.isArray(record.category_ids)) {
    return null;
  }
  return normalizeRecipeSyncValue({
    name: record.name,
    description: record.description ?? null,
    instructions: record.instructions ?? null,
    portions: record.portions ?? null,
    ingredients: record.ingredients ?? [],
    category_ids: record.category_ids ?? [],
  });
};

export const toRecipeSyncValue = (recipe: RecipeLike): RecipeSyncValue => {
  const categoryIds = recipe.category_ids
    ?? recipe.categories?.map((category) => category.id).filter((id): id is number => typeof id === 'number')
    ?? [];
  return normalizeRecipeSyncValue({
    name: recipe.name ?? '',
    description: recipe.description ?? null,
    instructions: recipe.instructions ?? null,
    portions: recipe.portions ?? null,
    ingredients: (recipe.ingredients ?? []).map((ingredient) => ({
      name: ingredient.name ?? '',
      quantity: normalizeQuantity(ingredient.quantity),
      unit: ingredient.unit ?? null,
    })),
    category_ids: categoryIds,
  });
};

export const recipeSyncValuesMatch = (
  left: RecipeSyncValue,
  right: RecipeSyncValue
): boolean => {
  const normalizedLeft = normalizeRecipeSyncValue(left);
  const normalizedRight = normalizeRecipeSyncValue(right);
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
};

export const recipeSyncChangeLabel = (value: RecipeSyncValue): string => {
  const normalized = normalizeRecipeSyncValue(value);
  const name = normalized.name || 'Untitled recipe';
  const detail = normalized.instructions?.split('\n')[0]?.slice(0, 60);
  return detail ? `${name} — ${detail}` : name;
};

export function replaceById<T extends { id: number }>(items: T[], item: T): T[] {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index === -1) {
    return [...items, item];
  }
  const next = items.slice();
  next[index] = item;
  return next;
}

export function overlayRecipe<T extends { categories?: Array<{ id: number }> }>(
  recipe: T,
  value: RecipeSyncValue
): T {
  const known = new Map((recipe.categories ?? []).map((category) => [category.id, category]));
  return {
    ...recipe,
    name: value.name,
    description: value.description,
    instructions: value.instructions,
    portions: value.portions,
    ingredients: value.ingredients.map((ingredient) => ({ ...ingredient })),
    categories: value.category_ids.map((id) => known.get(id) ?? {
      id,
      name: '',
      is_default: false,
      default_key: null,
      assignable: true,
    }),
  } as T;
}

export const mergeRecipePendingEdit = <T extends { recipeId: number; baseline: RecipeSyncValue; recipe: RecipeSyncValue }>(
  queue: T[],
  edit: T
): T[] => {
  const existing = queue.find((item) => item.recipeId === edit.recipeId);
  if (!existing) {
    if (recipeSyncValuesMatch(edit.baseline, edit.recipe)) {
      return queue;
    }
    return [...queue, edit];
  }
  if (recipeSyncValuesMatch(existing.baseline, edit.recipe)) {
    return queue.filter((item) => item.recipeId !== edit.recipeId);
  }
  return queue.map((item) => (
    item.recipeId === edit.recipeId
      ? { ...item, recipe: normalizeRecipeSyncValue(edit.recipe) }
      : item
  ));
};
