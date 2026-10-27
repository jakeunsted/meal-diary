import { normalizeMealDiaryWeekKey, weekStartKeyToLocalDate } from '../../composables/mealDiaryWeekKey';
import { isWeekAheadAllowed } from '../../utils/weekEntitlements';

interface MockApiOptions {
  userWithoutFamilyGroup?: boolean;
  entitlementsProfile?: 'premium' | 'free' | 'freeRecipeLimit' | 'trialExpired' | 'paymentFailed' | 'trialExhausted' | 'customMealNamesLapse' | 'customMealNamesLapseNonOwner' | 'alreadyDefault';
  failResetMealSlots?: boolean;
  recipes?: Array<Record<string, any>>;
  recipeCategories?: Array<Record<string, any>>;
}

export interface EntitlementsFixtureOptions {
  plan?: 'free' | 'premium';
  status?: 'active' | 'trialing' | 'expired' | 'payment_failed';
  features?: Partial<Record<string, boolean>>;
  usage?: { familyMemberCount?: number; recipeCount?: number };
  prompts?: {
    trialExpired?: boolean;
    paymentFailed?: boolean;
    paymentFailedUntil?: string | null;
    customMealNamesLapse?: boolean;
  };
  trial?: { endsAt: string; daysRemaining: number } | null;
  billing?: { isOwner?: boolean; ownerDisplayName?: string | null; trialAvailable?: boolean; storePlatform?: 'web' | 'ios' | 'android' | null };
}

export const createEntitlementsFixture = (options: EntitlementsFixtureOptions = {}) => {
  const plan = options.plan ?? 'premium';
  const isPremium = plan === 'premium';

  return {
    plan,
    status: options.status ?? (isPremium ? 'active' : 'active'),
    isComplimentary: false,
    features: {
      family_members: options.features?.family_members ?? true,
      weeks_ahead: options.features?.weeks_ahead ?? true,
      edit_past_weeks: options.features?.edit_past_weeks ?? isPremium,
      recipes: options.features?.recipes ?? true,
      recipe_to_shopping_list: options.features?.recipe_to_shopping_list ?? isPremium,
      custom_meal_slots: options.features?.custom_meal_slots ?? isPremium,
      custom_recipe_categories: options.features?.custom_recipe_categories ?? isPremium,
    },
    limits: {
      maxFamilyMembers: isPremium ? 8 : 2,
      maxRecipes: isPremium ? Number.POSITIVE_INFINITY : 10,
      maxWeeksAhead: isPremium ? Number.POSITIVE_INFINITY : 1,
      canEditPastWeeks: isPremium,
      canAddRecipeToShoppingList: isPremium,
      canCustomizeMealSlots: isPremium,
      canUseCustomRecipeCategories: isPremium,
    },
    usage: {
      familyMemberCount: options.usage?.familyMemberCount ?? 1,
      recipeCount: options.usage?.recipeCount ?? 1,
    },
    trial: options.trial ?? undefined,
    prompts: {
      trialExpired: options.prompts?.trialExpired ?? false,
      paymentFailed: options.prompts?.paymentFailed ?? false,
      paymentFailedUntil: options.prompts?.paymentFailedUntil ?? null,
      customMealNamesLapse: options.prompts?.customMealNamesLapse ?? false,
    },
    billing: {
      isOwner: options.billing?.isOwner ?? true,
      ownerDisplayName: options.billing?.ownerDisplayName ?? 'Meal',
      trialAvailable: options.billing?.trialAvailable ?? true,
      storePlatform: options.billing?.storePlatform ?? null,
    },
  };
};

const resolveEntitlementsProfile = (profile: MockApiOptions['entitlementsProfile']) => {
  switch (profile) {
    case 'free':
      return createEntitlementsFixture({ plan: 'free' });
    case 'freeRecipeLimit':
      return createEntitlementsFixture({
        plan: 'free',
        features: { recipes: false },
        usage: { recipeCount: 10 },
      });
    case 'trialExpired':
      return createEntitlementsFixture({
        plan: 'free',
        status: 'expired',
        prompts: { trialExpired: true },
      });
    case 'paymentFailed':
      return createEntitlementsFixture({
        plan: 'free',
        status: 'payment_failed',
        prompts: {
          paymentFailed: true,
          paymentFailedUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
    case 'trialExhausted':
      return createEntitlementsFixture({
        plan: 'free',
        billing: { trialAvailable: false },
      });
    case 'customMealNamesLapse':
      return createEntitlementsFixture({
        plan: 'free',
        status: 'expired',
        prompts: { trialExpired: true, customMealNamesLapse: true },
      });
    case 'customMealNamesLapseNonOwner':
      return createEntitlementsFixture({
        plan: 'free',
        status: 'expired',
        prompts: { customMealNamesLapse: true },
        billing: { isOwner: false, ownerDisplayName: 'Alex' },
      });
    case 'alreadyDefault':
      return createEntitlementsFixture({
        plan: 'free',
        status: 'expired',
        prompts: { customMealNamesLapse: false },
      });
    case 'premium':
    default:
      return createEntitlementsFixture({ plan: 'premium' });
  }
};

interface MockApiState {
  accessToken: string;
  refreshToken: string;
  activeUser: Record<string, any>;
  familyGroup: Record<string, any>;
  weeklyMeals: Array<Record<string, any>>;
  mealSlots: Array<Record<string, any>>;
  shoppingList: Record<string, any>;
  recipes: Array<Record<string, any>>;
  recipeCategories: Array<Record<string, any>>;
  entitlements: Record<string, any>;
}

const STUB_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjQxMDI0NDQ4MDAsInVzZXJJZCI6MX0.signature';

const getIsoDate = () => new Date().toISOString();

const getCurrentWeekStartKey = () => normalizeMealDiaryWeekKey(new Date());

const defaultMealSlots = () => [
  { id: 1, name: 'Breakfast', position: 1, legacy_key: 'breakfast' },
  { id: 2, name: 'Lunch', position: 2, legacy_key: 'lunch' },
  { id: 3, name: 'Dinner', position: 3, legacy_key: 'dinner' },
];

const customMealSlots = () => [
  { id: 1, name: 'Brekkie', position: 1, legacy_key: 'breakfast' },
  { id: 2, name: 'Lunch', position: 2, legacy_key: 'lunch' },
  { id: 3, name: 'Supper', position: 3, legacy_key: 'dinner' },
];

const usesCustomMealSlots = (profile: MockApiOptions['entitlementsProfile']) => {
  return profile === 'customMealNamesLapse' || profile === 'customMealNamesLapseNonOwner';
};

const createWeeklyMeals = (weekStartDate: string) => {
  const slots = defaultMealSlots().map((slot) => ({
    id: 0,
    meal_slot_id: slot.id,
    name: slot.name,
    position: slot.position,
    dish: null,
    recipe_id: null,
    legacy_key: slot.legacy_key,
  }));

  return Array.from({ length: 7 }, (_, index) => ({
    day_of_week: index + 1,
    breakfast: null,
    lunch: null,
    dinner: null,
    breakfast_recipe_id: null,
    lunch_recipe_id: null,
    dinner_recipe_id: null,
    week_start_date: weekStartDate,
    slots: slots.map((slot) => ({ ...slot })),
  }));
};

const createMockApiState = (options: MockApiOptions = {}): MockApiState => {
  const weekStartDate = getCurrentWeekStartKey();
  const userWithFamily = {
    id: 1,
    username: 'meal_diary_user',
    email: 'user@example.com',
    first_name: 'Meal',
    last_name: 'Tester',
    family_group_id: 1,
  };
  const userWithoutFamily = {
    ...userWithFamily,
    family_group_id: null,
  };
  const familyGroup = {
    id: 1,
    name: 'Test Family Group',
    random_identifier: 'FAMILY-TEST-123',
    created_by: 1,
    created_at: getIsoDate(),
    updated_at: getIsoDate(),
  };
  const shoppingListItems = [
    {
      id: 1001,
      shopping_list_id: 10,
      name: 'Tomatoes',
      checked: false,
      deleted: false,
      category: 'fruit_veg',
      position: 0,
      created_by: 1,
      created_at: getIsoDate(),
      updated_at: getIsoDate(),
    },
    {
      id: 1002,
      shopping_list_id: 10,
      name: 'Bread',
      checked: false,
      deleted: false,
      category: 'bakery',
      position: 0,
      created_by: 1,
      created_at: getIsoDate(),
      updated_at: getIsoDate(),
    },
  ];

  const shoppingList = {
    id: 10,
    family_group_id: 1,
    created_at: getIsoDate(),
    updated_at: getIsoDate(),
    items: shoppingListItems,
  };
  const defaultRecipes = [
    {
      id: 501,
      family_group_id: 1,
      created_by: 1,
      name: 'Pasta Bake',
      description: 'Simple pasta bake',
      instructions: 'Cook pasta, bake with sauce.',
      portions: 4,
      categories: [],
      ingredients: [
        { id: 1, recipe_id: 501, name: 'Pasta', quantity: 500, unit: 'g' },
        { id: 2, recipe_id: 501, name: 'Tomato sauce', quantity: 1, unit: 'jar' },
      ],
      created_at: getIsoDate(),
      updated_at: getIsoDate(),
    },
  ];
  const recipes = (options.recipes ?? defaultRecipes).map((recipe) => ({
    ...recipe,
    family_group_id: recipe.family_group_id ?? 1,
    created_by: recipe.created_by ?? 1,
    categories: recipe.categories ?? [],
  }));
  const recipeCategories = options.recipeCategories ?? [
    { id: 1, family_group_id: 1, name: 'Breakfast', is_default: true, default_key: 'breakfast', assignable: true },
    { id: 2, family_group_id: 1, name: 'Lunch', is_default: true, default_key: 'lunch', assignable: true },
    { id: 3, family_group_id: 1, name: 'Dinner', is_default: true, default_key: 'dinner', assignable: true },
    { id: 4, family_group_id: 1, name: 'Dessert', is_default: true, default_key: 'dessert', assignable: true },
  ];

  return {
    accessToken: STUB_TOKEN,
    refreshToken: STUB_TOKEN,
    activeUser: options.userWithoutFamilyGroup ? userWithoutFamily : userWithFamily,
    familyGroup,
    weeklyMeals: createWeeklyMeals(weekStartDate),
    mealSlots: usesCustomMealSlots(options.entitlementsProfile) ? customMealSlots() : defaultMealSlots(),
    shoppingList,
    recipes,
    recipeCategories,
    entitlements: resolveEntitlementsProfile(options.entitlementsProfile),
  };
};

const STARTER_KEY_ORDER = ['breakfast', 'lunch', 'dinner', 'dessert'];

const sortRecipeCategories = (categories: Array<Record<string, any>>) => {
  return [...categories].sort((left, right) => {
    const leftIndex = STARTER_KEY_ORDER.indexOf(left.default_key);
    const rightIndex = STARTER_KEY_ORDER.indexOf(right.default_key);
    const leftRank = leftIndex === -1 ? Number.POSITIVE_INFINITY : leftIndex;
    const rightRank = rightIndex === -1 ? Number.POSITIVE_INFINITY : rightIndex;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return String(left.name).localeCompare(String(right.name), undefined, { sensitivity: 'base' });
  });
};

const categoryNameMessage = (code: string) => {
  switch (code) {
    case 'empty':
      return 'Category name is required';
    case 'too_long':
      return 'Category name must be 32 characters or fewer';
    case 'emoji':
      return 'Category name cannot include emoji';
    case 'control_chars':
      return 'Category name cannot include control characters';
    case 'duplicate':
      return 'A category with this name already exists';
    default:
      return 'Invalid category name';
  }
};

export const installMockApi = (options: MockApiOptions = {}) => {
  const state = createMockApiState(options);
  let nextItemId = 2000;
  let nextRecipeId = 900;
  let nextCategoryId = Math.max(
    0,
    ...state.recipeCategories.map((category) => Number(category.id) || 0),
  ) + 1;

  const canUseCustomRecipeCategories = () => Boolean(state.entitlements.features?.custom_recipe_categories);

  const presentCategory = (category: Record<string, any>, assignable: boolean) => ({
    id: category.id,
    family_group_id: category.family_group_id ?? state.familyGroup.id,
    name: category.name,
    is_default: Boolean(category.is_default),
    default_key: category.default_key ?? null,
    assignable,
  });

  const visibleRecipeCategories = () => {
    const featureOn = canUseCustomRecipeCategories();
    return sortRecipeCategories(state.recipeCategories)
      .filter((category) => featureOn || category.is_default)
      .map((category) => presentCategory(category, true));
  };

  const presentRecipe = (recipe: Record<string, any>) => {
    const featureOn = canUseCustomRecipeCategories();
    const categories = sortRecipeCategories(
      (recipe.categories ?? [])
        .map((category: Record<string, any>) =>
          state.recipeCategories.find((entry) => entry.id === category.id)
        )
        .filter(Boolean)
    ).map((category: Record<string, any>) => ({
      id: category.id,
      name: category.name,
      is_default: Boolean(category.is_default),
      default_key: category.default_key ?? null,
      assignable: Boolean(category.is_default) || featureOn,
    }));
    const { category_ids: _categoryIds, ...rest } = recipe;
    return { ...rest, categories };
  };

  const categoryNameError = (name: unknown, ignoreId?: number) => {
    const normalized = String(name ?? '').trim();
    if (!normalized) {
      return 'empty';
    }
    if (normalized.length > 32) {
      return 'too_long';
    }
    if (/\p{Extended_Pictographic}/u.test(normalized)) {
      return 'emoji';
    }
    if (/[\u0000-\u001F\u007F-\u009F]/.test(normalized)) {
      return 'control_chars';
    }
    const duplicate = state.recipeCategories.some((category) => {
      if (ignoreId != null && category.id === ignoreId) {
        return false;
      }
      return String(category.name).trim().toLowerCase() === normalized.toLowerCase();
    });
    return duplicate ? 'duplicate' : null;
  };

  const entitlementRequired = () => ({
    statusCode: 403,
    body: {
      code: 'ENTITLEMENT_REQUIRED',
      feature: 'custom_recipe_categories',
      plan: state.entitlements.plan ?? 'free',
      upgradeUrl: '/plans',
    },
  });

  const applyCategoryIds = (recipe: Record<string, any>, categoryIds: number[]) => {
    const uniqueIds = [...new Set(categoryIds.map((id) => Number(id)))];
    const featureOn = canUseCustomRecipeCategories();
    const existingIds = new Set((recipe.categories ?? []).map((category: Record<string, any>) => category.id));
    for (const id of uniqueIds) {
      const category = state.recipeCategories.find((entry) => entry.id === id);
      if (!category) {
        return { error: 'invalid_category' as const };
      }
      if (!category.is_default && !existingIds.has(id) && !featureOn) {
        return { error: 'entitlement' as const };
      }
    }
    return {
      categories: uniqueIds
        .map((id) => state.recipeCategories.find((entry) => entry.id === id))
        .filter(Boolean),
    };
  };

  const replyCategoryIds = (
    req: { reply: (response: Record<string, any>) => void; body: Record<string, any> },
    recipe: Record<string, any>,
    categoryIds: unknown,
  ) => {
    if (!Array.isArray(categoryIds)) {
      return { ok: true as const, categories: recipe.categories ?? [] };
    }
    const applied = applyCategoryIds(recipe, categoryIds);
    if (applied.error === 'invalid_category') {
      req.reply({
        statusCode: 400,
        body: { code: 'invalid_category', message: 'One or more categories are not in this family' },
      });
      return { ok: false as const };
    }
    if (applied.error === 'entitlement') {
      req.reply(entitlementRequired());
      return { ok: false as const };
    }
    return { ok: true as const, categories: applied.categories };
  };

  cy.intercept('GET', '/api/health', { statusCode: 200, body: { status: 'ok' } });

  cy.intercept('POST', '/api/auth/login', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        user: state.activeUser,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        entitlements: state.entitlements,
      },
    });
  }).as('apiLogin');

  cy.intercept('POST', '/api/auth/refresh-token', {
    statusCode: 200,
    body: {
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
    },
  });

  cy.intercept('POST', '/api/auth/logout', {
    statusCode: 200,
    body: { message: 'Logged out successfully' },
  });

  cy.intercept('GET', /\/api\/user\/\d+$/, (req) => {
    req.reply({ statusCode: 200, body: state.activeUser });
  }).as('apiFetchUser');

  cy.intercept('PUT', /\/api\/user\/\d+$/, (req) => {
    state.activeUser = { ...state.activeUser, ...req.body };
    req.reply({ statusCode: 200, body: state.activeUser });
  });

  cy.intercept('POST', '/api/family-groups/create', (req) => {
    state.activeUser = { ...state.activeUser, family_group_id: state.familyGroup.id };
    req.reply({
      statusCode: 200,
      body: {
        data: state.familyGroup,
      },
    });
  }).as('apiCreateFamilyGroup');

  cy.intercept('POST', '/api/family-groups/join', (req) => {
    const familyKey = req.body?.random_identifier;
    if (familyKey === 'NOT-FOUND') {
      req.reply({ statusCode: 404, body: { message: 'Family group not found' } });
      return;
    }
    state.activeUser = { ...state.activeUser, family_group_id: state.familyGroup.id };
    req.reply({
      statusCode: 200,
      body: {
        data: state.familyGroup,
      },
    });
  }).as('apiJoinFamilyGroup');

  cy.intercept('GET', /\/api\/family-groups\/\d+\/entitlements$/, (req) => {
    req.reply({
      statusCode: 200,
      body: state.entitlements,
    });
  }).as('apiGetEntitlements');

  cy.intercept('POST', '/api/billing/create-checkout-session', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        id: 'cs_test',
        url: 'https://checkout.stripe.com/c/pay/cs_test',
      },
    });
  }).as('apiCreateCheckoutSession');

  cy.intercept('POST', /\/api\/family-groups\/\d+\/entitlements\/dismiss-prompt$/, (req) => {
    state.entitlements = {
      ...state.entitlements,
      prompts: {
        ...state.entitlements.prompts,
        trialExpired: false,
      },
    };
    req.reply({
      statusCode: 200,
      body: state.entitlements,
    });
  }).as('apiDismissEntitlementPrompt');

  cy.intercept('POST', /\/api\/family-groups\/\d+\/meal-slots\/reset-to-defaults$/, (req) => {
    if (options.failResetMealSlots) {
      req.reply({
        statusCode: 400,
        body: { code: 'MEAL_SLOTS_VALIDATION_ERROR', message: 'Invalid meal slots' },
      });
      return;
    }

    if (!req.body?.today) {
      req.reply({ statusCode: 400, body: { message: 'today is required' } });
      return;
    }

    state.entitlements = {
      ...state.entitlements,
      prompts: {
        ...state.entitlements.prompts,
        customMealNamesLapse: false,
      },
    };
    state.mealSlots = defaultMealSlots();
    req.reply({
      statusCode: 200,
      body: state.entitlements,
    });
  }).as('apiResetMealSlots');

  cy.intercept('GET', /\/api\/family-groups\/\d+$/, {
    statusCode: 200,
    body: {
      data: state.familyGroup,
      headers: {},
    },
  }).as('apiGetFamilyGroup');

  cy.intercept('GET', /\/api\/family-groups\/\d+\/members$/, {
    statusCode: 200,
    body: {
      data: [
        state.activeUser,
        {
          id: 2,
          username: 'family_member',
          email: 'member@example.com',
          avatar_url: '/temp-avatars/generic-avatar.png',
          created_at: getIsoDate(),
          updated_at: getIsoDate(),
        },
      ],
      headers: {},
    },
  }).as('apiGetFamilyMembers');

  cy.intercept('GET', /\/api\/shopping-list\/\d+$/, (req) => {
    req.reply({
      statusCode: 200,
      body: {
        ...state.shoppingList,
        data: state.shoppingList,
      },
    });
  }).as('apiGetShoppingList');

  cy.intercept('POST', /\/api\/shopping-list\/\d+\/items$/, (req) => {
    const category = req.body?.category || 'other';
    const siblingPositions = state.shoppingList.items
      .filter((item: Record<string, any>) => item.category === category)
      .map((item: Record<string, any>) => item.position || 0);
    const nextPosition = siblingPositions.length > 0 ? Math.max(...siblingPositions) + 1 : 0;
    const newItem = {
      id: nextItemId++,
      shopping_list_id: state.shoppingList.id,
      name: req.body?.name || 'New Item',
      checked: false,
      deleted: false,
      category,
      position: nextPosition,
      created_by: state.activeUser.id,
      created_at: getIsoDate(),
      updated_at: getIsoDate(),
    };
    state.shoppingList.items.push(newItem);
    req.reply({ statusCode: 200, body: newItem });
  }).as('apiAddShoppingItem');

  cy.intercept('POST', /\/api\/shopping-list\/\d+\/items\/bulk$/, (req) => {
    const bulkItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const createdItems = bulkItems.map((entry: Record<string, any>) => {
      const category = entry.category || 'other';
      const siblingPositions = state.shoppingList.items
        .filter((item: Record<string, any>) => item.category === category)
        .map((item: Record<string, any>) => item.position || 0);
      const nextPosition = siblingPositions.length > 0 ? Math.max(...siblingPositions) + 1 : 0;
      return {
        id: nextItemId++,
        shopping_list_id: state.shoppingList.id,
        name: entry.name || 'New Item',
        checked: false,
        deleted: false,
        category,
        position: nextPosition,
        created_by: state.activeUser.id,
        created_at: getIsoDate(),
        updated_at: getIsoDate(),
      };
    });
    state.shoppingList.items.push(...createdItems);
    req.reply({
      statusCode: 200,
      body: {
        data: createdItems,
      },
    });
  }).as('apiAddShoppingItemBulk');

  cy.intercept('PUT', /\/api\/shopping-list\/\d+\/items\/.+$/, (req) => {
    const itemId = String(req.url.split('/').pop());
    const item = state.shoppingList.items.find((entry: Record<string, any>) => String(entry.id) === itemId);
    if (item) {
      Object.assign(item, req.body, { updated_at: getIsoDate() });
      req.reply({
        statusCode: 200,
        body: { data: item },
      });
      return;
    }
    req.reply({ statusCode: 404, body: { message: 'Item not found' } });
  }).as('apiUpdateShoppingItem');

  cy.intercept('DELETE', /\/api\/shopping-list\/\d+\/items\/.+$/, (req) => {
    const itemId = String(req.url.split('/').pop());
    const itemIndex = state.shoppingList.items.findIndex((entry: Record<string, any>) => String(entry.id) === itemId);
    if (itemIndex !== -1) {
      state.shoppingList.items.splice(itemIndex, 1);
      req.reply({ statusCode: 200, body: { message: 'Deleted' } });
      return;
    }
    req.reply({ statusCode: 200, body: { message: 'No-op delete' } });
  }).as('apiDeleteShoppingItem');

  cy.intercept('PUT', /\/api\/shopping-list\/\d+\/items\/reorder$/, (req) => {
    const reorderItems = req.body?.items || [];
    reorderItems.forEach((change: Record<string, any>) => {
      const existingItem = state.shoppingList.items.find((entry: Record<string, any>) => entry.id === change.id);
      if (existingItem) {
        if (change.category !== undefined) {
          existingItem.category = change.category;
        }
        existingItem.position = change.position ?? existingItem.position;
      }
    });
    req.reply({ statusCode: 200, body: { message: 'Reordered' } });
  }).as('apiReorderShoppingItems');

  // Registered after the generic PUT /items/.+ so this literal path takes precedence
  cy.intercept('PUT', /\/api\/shopping-list\/\d+\/items\/bulk-update$/, (req) => {
    const updates = Array.isArray(req.body?.items) ? req.body.items : [];
    const updatedItems: Record<string, any>[] = [];
    updates.forEach((update: Record<string, any>) => {
      const item = state.shoppingList.items.find((entry: Record<string, any>) => entry.id === update.id);
      if (item) {
        if (update.name !== undefined) {
          item.name = update.name;
        }
        if (update.checked !== undefined) {
          item.checked = update.checked;
        }
        if (update.deleted !== undefined) {
          item.deleted = update.deleted;
        }
        if (update.category !== undefined) {
          item.category = update.category;
        }
        item.updated_at = getIsoDate();
        updatedItems.push(item);
      }
    });
    req.reply({ statusCode: 200, body: { data: updatedItems } });
  }).as('apiBulkUpdateShoppingItems');

  cy.intercept('POST', /\/api\/shopping-list\/\d+\/items\/bulk-delete$/, (req) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const deletedItems = state.shoppingList.items.filter(
      (entry: Record<string, any>) => ids.includes(String(entry.id)),
    );
    state.shoppingList.items = state.shoppingList.items.filter(
      (entry: Record<string, any>) => !ids.includes(String(entry.id)),
    );
    req.reply({ statusCode: 200, body: { data: deletedItems } });
  }).as('apiBulkDeleteShoppingItems');

  cy.intercept('GET', /\/api\/meal-diaries\/\d+\/.*\/daily-meals$/, (req) => {
    const weekMatch = req.url.match(/meal-diaries\/\d+\/([^/]+)\/daily-meals/);
    const weekStartDate = weekMatch?.[1] || getCurrentWeekStartKey();
    const maxWeeksAhead = state.entitlements.limits?.maxWeeksAhead;
    const requestedWeekStart = weekStartKeyToLocalDate(weekStartDate);

    if (
      requestedWeekStart &&
      Number.isFinite(maxWeeksAhead) &&
      !isWeekAheadAllowed(requestedWeekStart, maxWeeksAhead)
    ) {
      req.reply({
        statusCode: 403,
        body: {
          code: 'ENTITLEMENT_REQUIRED',
          feature: 'weeks_ahead',
          plan: state.entitlements.plan ?? 'free',
          upgradeUrl: '/plans',
        },
      });
      return;
    }

    req.reply({
      statusCode: 200,
      body: createWeeklyMeals(weekStartDate),
    });
  }).as('apiGetMealDiary');

  cy.intercept('PATCH', /\/api\/meal-diaries\/\d+\/daily-meals$/, (req) => {
    const incomingMeal = req.body;
    const dayIndex = state.weeklyMeals.findIndex(
      (entry) => entry.day_of_week === incomingMeal.day_of_week,
    );
    if (dayIndex !== -1) {
      state.weeklyMeals[dayIndex] = {
        ...state.weeklyMeals[dayIndex],
        ...incomingMeal,
      };
    } else {
      state.weeklyMeals.push(incomingMeal);
    }
    req.reply({
      statusCode: 200,
      body: {
        data: incomingMeal,
      },
    });
  }).as('apiPatchMealDiary');

  cy.intercept('GET', /\/api\/family-groups\/\d+\/meal-slots$/, (req) => {
    req.reply({ statusCode: 200, body: { slots: state.mealSlots } });
  }).as('apiGetMealSlots');

  cy.intercept('PUT', /\/api\/family-groups\/\d+\/meal-slots$/, (req) => {
    const canCustomize = state.entitlements.features?.custom_meal_slots;
    if (!canCustomize) {
      req.reply({
        statusCode: 403,
        body: {
          code: 'ENTITLEMENT_REQUIRED',
          feature: 'custom_meal_slots',
          plan: state.entitlements.plan ?? 'free',
          upgradeUrl: '/plans',
        },
      });
      return;
    }

    const slots = Array.isArray(req.body?.slots) ? req.body.slots : [];
    const currentById = new Map(state.mealSlots.map((slot) => [slot.id, slot]));
    const removed = state.mealSlots.filter(
      (slot) => !slots.some((next: Record<string, any>) => next.id === slot.id),
    );

    if (removed.length && !req.body?.confirm) {
      const futureCounts = removed.map((slot) => ({
        id: slot.id,
        name: slot.name,
        futureMealsWithContent: slot.name === 'Lunch' ? 2 : 0,
      }));
      if (futureCounts.some((entry) => entry.futureMealsWithContent > 0)) {
        req.reply({
          statusCode: 409,
          body: {
            code: 'MEAL_SLOTS_CONFIRMATION_REQUIRED',
            removed: futureCounts.filter((entry) => entry.futureMealsWithContent > 0),
          },
        });
        return;
      }
    }

    state.mealSlots = slots.map((slot: Record<string, any>, index: number) => {
      const existing = slot.id != null ? currentById.get(slot.id) : undefined;
      return {
        id: existing?.id ?? 100 + index,
        name: slot.name,
        position: index + 1,
        legacy_key: existing?.legacy_key ?? null,
      };
    });

    req.reply({ statusCode: 200, body: { slots: state.mealSlots } });
  }).as('apiPutMealSlots');

  cy.intercept('GET', /\/api\/family-groups\/\d+\/recipe-categories$/, (req) => {
    req.reply({ statusCode: 200, body: { categories: visibleRecipeCategories() } });
  }).as('apiGetRecipeCategories');

  cy.intercept('POST', /\/api\/family-groups\/\d+\/recipe-categories$/, (req) => {
    if (!canUseCustomRecipeCategories()) {
      req.reply(entitlementRequired());
      return;
    }
    const code = categoryNameError(req.body?.name);
    if (code) {
      req.reply({ statusCode: 400, body: { code, message: categoryNameMessage(code) } });
      return;
    }
    const category = {
      id: nextCategoryId++,
      family_group_id: state.familyGroup.id,
      name: String(req.body?.name ?? '').trim(),
      is_default: false,
      default_key: null,
      assignable: true,
    };
    state.recipeCategories.push(category);
    req.reply({ statusCode: 201, body: { category: presentCategory(category, true) } });
  }).as('apiCreateRecipeCategory');

  cy.intercept('PATCH', /\/api\/family-groups\/\d+\/recipe-categories\/\d+$/, (req) => {
    const categoryId = Number(req.url.split('/').pop());
    const category = state.recipeCategories.find((entry) => entry.id === categoryId);
    if (!category) {
      req.reply({ statusCode: 404, body: { message: 'Category not found' } });
      return;
    }
    if (category.is_default) {
      req.reply({
        statusCode: 400,
        body: { code: 'default_category_locked', message: 'Starter categories cannot be renamed or deleted' },
      });
      return;
    }
    if (!canUseCustomRecipeCategories()) {
      req.reply(entitlementRequired());
      return;
    }
    const code = categoryNameError(req.body?.name, categoryId);
    if (code) {
      req.reply({ statusCode: 400, body: { code, message: categoryNameMessage(code) } });
      return;
    }
    category.name = String(req.body?.name ?? '').trim();
    req.reply({ statusCode: 200, body: { category: presentCategory(category, true) } });
  }).as('apiUpdateRecipeCategory');

  cy.intercept('DELETE', /\/api\/family-groups\/\d+\/recipe-categories\/\d+$/, (req) => {
    const categoryId = Number(req.url.split('/').pop());
    const category = state.recipeCategories.find((entry) => entry.id === categoryId);
    if (!category) {
      req.reply({ statusCode: 404, body: { message: 'Category not found' } });
      return;
    }
    if (category.is_default) {
      req.reply({
        statusCode: 400,
        body: { code: 'default_category_locked', message: 'Starter categories cannot be renamed or deleted' },
      });
      return;
    }
    if (!canUseCustomRecipeCategories()) {
      req.reply(entitlementRequired());
      return;
    }
    state.recipeCategories = state.recipeCategories.filter((entry) => entry.id !== categoryId);
    state.recipes = state.recipes.map((recipe) => ({
      ...recipe,
      categories: (recipe.categories ?? []).filter((entry: Record<string, any>) => entry.id !== categoryId),
    }));
    req.reply({ statusCode: 200, body: { ok: true } });
  }).as('apiDeleteRecipeCategory');

  cy.intercept('GET', /\/api\/recipes\/family\/\d+(\?.*)?$/, (req) => {
    const search = req.query.search?.toString().toLowerCase() || '';
    const filteredRecipes = search
      ? state.recipes.filter((recipe) => recipe.name.toLowerCase().includes(search))
      : state.recipes;
    req.reply({ statusCode: 200, body: filteredRecipes.map(presentRecipe) });
  }).as('apiGetRecipes');

  cy.intercept('POST', '/api/recipes', (req) => {
    const body = { ...(req.body ?? {}) };
    const categoryIds = body.category_ids;
    delete body.category_ids;
    const newRecipe = {
      id: nextRecipeId++,
      family_group_id: state.familyGroup.id,
      created_by: state.activeUser.id,
      created_at: getIsoDate(),
      updated_at: getIsoDate(),
      categories: [],
      ...body,
    };
    const applied = replyCategoryIds(req, { categories: [] }, categoryIds);
    if (!applied.ok) {
      return;
    }
    newRecipe.categories = applied.categories;
    state.recipes.push(newRecipe);
    req.reply({ statusCode: 200, body: presentRecipe(newRecipe) });
  }).as('apiCreateRecipe');

  cy.intercept('GET', /\/api\/recipes\/\d+$/, (req) => {
    const recipeId = Number(req.url.split('/').pop());
    const recipe = state.recipes.find((entry) => entry.id === recipeId);
    if (!recipe) {
      req.reply({ statusCode: 404, body: { message: 'Recipe not found' } });
      return;
    }
    req.reply({ statusCode: 200, body: presentRecipe(recipe) });
  }).as('apiGetRecipeById');

  cy.intercept('PUT', /\/api\/recipes\/\d+$/, (req) => {
    const recipeId = Number(req.url.split('/').pop());
    const recipeIndex = state.recipes.findIndex((entry) => entry.id === recipeId);
    if (recipeIndex === -1) {
      req.reply({ statusCode: 404, body: { message: 'Recipe not found' } });
      return;
    }
    const body = { ...(req.body ?? {}) };
    const categoryIds = body.category_ids;
    delete body.category_ids;
    const applied = replyCategoryIds(req, state.recipes[recipeIndex], categoryIds);
    if (!applied.ok) {
      return;
    }
    state.recipes[recipeIndex] = {
      ...state.recipes[recipeIndex],
      ...body,
      categories: applied.categories,
      updated_at: getIsoDate(),
    };
    req.reply({ statusCode: 200, body: presentRecipe(state.recipes[recipeIndex]) });
  }).as('apiUpdateRecipe');

  cy.intercept('DELETE', /\/api\/recipes\/\d+$/, (req) => {
    const recipeId = Number(req.url.split('/').pop());
    state.recipes = state.recipes.filter((entry) => entry.id !== recipeId);
    req.reply({ statusCode: 200, body: { message: 'Recipe deleted' } });
  }).as('apiDeleteRecipe');

  cy.intercept('POST', '/api/user', {
    statusCode: 201,
    body: {
      id: 99,
      message: 'Registration complete',
    },
  }).as('apiRegisterUser');

  return state;
};
