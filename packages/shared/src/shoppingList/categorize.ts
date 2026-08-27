import {
  DEFAULT_SHOPPING_CATEGORY,
  type ShoppingCategory,
} from './categories.ts';

/**
 * Keyword lists per category. Longer phrases are matched first so
 * "chicken breast" beats a generic "breast" if both existed.
 * Matching is whole-word / phrase against a normalized name.
 */
const CATEGORY_KEYWORDS: Record<Exclude<ShoppingCategory, 'other'>, string[]> = {
  meat: [
    'minced beef',
    'ground beef',
    'mince beef',
    'beef mince',
    'chicken breast',
    'chicken thigh',
    'chicken wing',
    'pork chop',
    'lamb chop',
    'turkey mince',
    'turkey breast',
    'bacon',
    'sausage',
    'sausages',
    'salami',
    'chorizo',
    'ham',
    'beef',
    'pork',
    'lamb',
    'chicken',
    'turkey',
    'duck',
    'veal',
    'steak',
    'mince',
    'minced',
    'meatball',
    'meatballs',
    'ribs',
    'brisket',
    'gammon',
    'prosciutto',
    'pepperoni',
    'patties',
    'burger',
    'burgers',
    'fish',
    'salmon',
    'tuna',
    'cod',
    'haddock',
    'prawn',
    'prawns',
    'shrimp',
    'shrimps',
    'crab',
    'lobster',
    'mussel',
    'mussels',
    'seafood',
  ],
  fruit_veg: [
    'sweet potato',
    'sweet potatoes',
    'bell pepper',
    'bell peppers',
    'green bean',
    'green beans',
    'runner bean',
    'runner beans',
    'brussels sprout',
    'brussels sprouts',
    'spring onion',
    'spring onions',
    'red onion',
    'red onions',
    'cherry tomato',
    'cherry tomatoes',
    'apple',
    'apples',
    'banana',
    'bananas',
    'orange',
    'oranges',
    'lemon',
    'lemons',
    'lime',
    'limes',
    'grape',
    'grapes',
    'strawberry',
    'strawberries',
    'blueberry',
    'blueberries',
    'raspberry',
    'raspberries',
    'blackberry',
    'blackberries',
    'mango',
    'mangoes',
    'pineapple',
    'avocado',
    'avocados',
    'peach',
    'peaches',
    'pear',
    'pears',
    'plum',
    'plums',
    'kiwi',
    'melon',
    'watermelon',
    'berry',
    'berries',
    'fruit',
    'potato',
    'potatoes',
    'tomato',
    'tomatoes',
    'onion',
    'onions',
    'garlic',
    'carrot',
    'carrots',
    'broccoli',
    'cauliflower',
    'spinach',
    'lettuce',
    'cabbage',
    'cucumber',
    'cucumbers',
    'pepper',
    'peppers',
    'courgette',
    'courgettes',
    'zucchini',
    'aubergine',
    'aubergines',
    'eggplant',
    'celery',
    'leek',
    'leeks',
    'mushroom',
    'mushrooms',
    'corn',
    'sweetcorn',
    'peas',
    'bean',
    'beans',
    'lentil',
    'lentils',
    'chickpea',
    'chickpeas',
    'salad',
    'herb',
    'herbs',
    'basil',
    'parsley',
    'coriander',
    'cilantro',
    'mint',
    'thyme',
    'rosemary',
    'ginger',
    'chilli',
    'chillies',
    'chili',
    'chilies',
    'veg',
    'vegetable',
    'vegetables',
  ],
  bakery: [
    'bread roll',
    'bread rolls',
    'hot dog bun',
    'hot dog buns',
    'burger bun',
    'burger buns',
    'sourdough',
    'baguette',
    'ciabatta',
    'focaccia',
    'brioche',
    'croissant',
    'croissants',
    'bagel',
    'bagels',
    'muffin',
    'muffins',
    'crumpet',
    'crumpets',
    'pita',
    'pitta',
    'tortilla',
    'tortillas',
    'wrap',
    'wraps',
    'naan',
    'roti',
    'chapati',
    'pastry',
    'pastries',
    'bread',
    'loaf',
    'rolls',
    'bun',
    'buns',
    'cake',
    'cakes',
    'cookie',
    'cookies',
    'biscuit',
    'biscuits',
    'doughnut',
    'doughnuts',
    'donut',
    'donuts',
    'brownie',
    'brownies',
    'scone',
    'scones',
  ],
  canned: [
    'tinned tomato',
    'tinned tomatoes',
    'canned tomato',
    'canned tomatoes',
    'chopped tomato',
    'chopped tomatoes',
    'plum tomato',
    'plum tomatoes',
    'coconut milk',
    'coconut cream',
    'baked bean',
    'baked beans',
    'kidney bean',
    'kidney beans',
    'black bean',
    'black beans',
    'chickpea',
    'chickpeas',
    'tinned',
    'canned',
    'tin',
    'soup',
    'stock',
    'broth',
    'passata',
    'tomato puree',
    'tomato paste',
  ],
};

interface KeywordEntry {
  keyword: string;
  category: Exclude<ShoppingCategory, 'other'>;
}

const KEYWORD_ENTRIES: KeywordEntry[] = (() => {
  const entries: KeywordEntry[] = [];
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [Exclude<ShoppingCategory, 'other'>, string[]]
  >) {
    for (const keyword of keywords) {
      entries.push({ keyword: keyword.toLowerCase(), category });
    }
  }
  // Longest first so multi-word phrases win over shorter substrings.
  entries.sort((a, b) => b.keyword.length - a.keyword.length);
  return entries;
})();

/** Strip trailing quantity parentheses e.g. "Pasta (500 g)" → "Pasta". */
export function normalizeShoppingItemName(name: string): string {
  return name
    .trim()
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim()
    .toLowerCase();
}

function matchesKeyword(normalized: string, keyword: string): boolean {
  if (normalized === keyword) {
    return true;
  }
  // Word-boundary match: keyword as whole words within the name.
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);
  return pattern.test(normalized);
}

export function categorizeShoppingItemName(name: string): ShoppingCategory {
  const normalized = normalizeShoppingItemName(name);
  if (!normalized) {
    return DEFAULT_SHOPPING_CATEGORY;
  }

  for (const entry of KEYWORD_ENTRIES) {
    if (matchesKeyword(normalized, entry.keyword)) {
      return entry.category;
    }
  }

  return DEFAULT_SHOPPING_CATEGORY;
}
