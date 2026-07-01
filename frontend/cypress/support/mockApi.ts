import { normalizeMealDiaryWeekKey } from '../../composables/mealDiaryWeekKey';

interface MockApiOptions {
  userWithoutFamilyGroup?: boolean;
  entitlementsProfile?: 'premium' | 'free' | 'freeRecipeLimit' | 'trialExpired' | 'paymentFailed' | 'trialExhausted';
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
    },
    limits: {
      maxFamilyMembers: isPremium ? 8 : 2,
      maxRecipes: isPremium ? Number.POSITIVE_INFINITY : 10,
      maxWeeksAhead: isPremium ? Number.POSITIVE_INFINITY : 1,
      canEditPastWeeks: isPremium,
      canAddRecipeToShoppingList: isPremium,
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
  shoppingList: Record<string, any>;
  recipes: Array<Record<string, any>>;
  entitlements: Record<string, any>;
}

const STUB_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjQxMDI0NDQ4MDAsInVzZXJJZCI6MX0.signature';

const getIsoDate = () => new Date().toISOString();

const getCurrentWeekStartKey = () => normalizeMealDiaryWeekKey(new Date());

const createWeeklyMeals = (weekStartDate: string) => {
  return Array.from({ length: 7 }, (_, index) => ({
    day_of_week: index + 1,
    breakfast: null,
    lunch: null,
    dinner: null,
    breakfast_recipe_id: null,
    lunch_recipe_id: null,
    dinner_recipe_id: null,
    week_start_date: weekStartDate,
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
      parent_item_id: null,
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
      parent_item_id: null,
      position: 1,
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
  const recipes = [
    {
      id: 501,
      family_group_id: 1,
      created_by: 1,
      name: 'Pasta Bake',
      description: 'Simple pasta bake',
      instructions: 'Cook pasta, bake with sauce.',
      portions: 4,
      ingredients: [
        { id: 1, recipe_id: 501, name: 'Pasta', quantity: 500, unit: 'g' },
        { id: 2, recipe_id: 501, name: 'Tomato sauce', quantity: 1, unit: 'jar' },
      ],
      created_at: getIsoDate(),
      updated_at: getIsoDate(),
    },
  ];

  return {
    accessToken: STUB_TOKEN,
    refreshToken: STUB_TOKEN,
    activeUser: options.userWithoutFamilyGroup ? userWithoutFamily : userWithFamily,
    familyGroup,
    weeklyMeals: createWeeklyMeals(weekStartDate),
    shoppingList,
    recipes,
    entitlements: resolveEntitlementsProfile(options.entitlementsProfile),
  };
};

export const installMockApi = (options: MockApiOptions = {}) => {
  const state = createMockApiState(options);
  let nextItemId = 2000;
  let nextRecipeId = 900;

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
    const siblingPositions = state.shoppingList.items
      .filter((item: Record<string, any>) => item.parent_item_id === (req.body?.parent_item_id ?? null))
      .map((item: Record<string, any>) => item.position || 0);
    const nextPosition = siblingPositions.length > 0 ? Math.max(...siblingPositions) + 1 : 0;
    const newItem = {
      id: nextItemId++,
      shopping_list_id: state.shoppingList.id,
      name: req.body?.name || 'New Item',
      checked: false,
      deleted: false,
      parent_item_id: req.body?.parent_item_id ?? null,
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
      const siblingPositions = state.shoppingList.items
        .filter((item: Record<string, any>) => item.parent_item_id === (entry.parent_item_id ?? null))
        .map((item: Record<string, any>) => item.position || 0);
      const nextPosition = siblingPositions.length > 0 ? Math.max(...siblingPositions) + 1 : 0;
      return {
        id: nextItemId++,
        shopping_list_id: state.shoppingList.id,
        name: entry.name || 'New Item',
        checked: false,
        deleted: false,
        parent_item_id: entry.parent_item_id ?? null,
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
        existingItem.parent_item_id = change.parent_item_id ?? null;
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

  cy.intercept('GET', /\/api\/recipes\/family\/\d+(\?.*)?$/, (req) => {
    const search = req.query.search?.toString().toLowerCase() || '';
    const filteredRecipes = search
      ? state.recipes.filter((recipe) => recipe.name.toLowerCase().includes(search))
      : state.recipes;
    req.reply({ statusCode: 200, body: filteredRecipes });
  }).as('apiGetRecipes');

  cy.intercept('POST', '/api/recipes', (req) => {
    const newRecipe = {
      id: nextRecipeId++,
      family_group_id: state.familyGroup.id,
      created_by: state.activeUser.id,
      created_at: getIsoDate(),
      updated_at: getIsoDate(),
      ...req.body,
    };
    state.recipes.push(newRecipe);
    req.reply({ statusCode: 200, body: newRecipe });
  }).as('apiCreateRecipe');

  cy.intercept('GET', /\/api\/recipes\/\d+$/, (req) => {
    const recipeId = Number(req.url.split('/').pop());
    const recipe = state.recipes.find((entry) => entry.id === recipeId);
    if (!recipe) {
      req.reply({ statusCode: 404, body: { message: 'Recipe not found' } });
      return;
    }
    req.reply({ statusCode: 200, body: recipe });
  }).as('apiGetRecipeById');

  cy.intercept('PUT', /\/api\/recipes\/\d+$/, (req) => {
    const recipeId = Number(req.url.split('/').pop());
    const recipeIndex = state.recipes.findIndex((entry) => entry.id === recipeId);
    if (recipeIndex === -1) {
      req.reply({ statusCode: 404, body: { message: 'Recipe not found' } });
      return;
    }
    state.recipes[recipeIndex] = {
      ...state.recipes[recipeIndex],
      ...req.body,
      updated_at: getIsoDate(),
    };
    req.reply({ statusCode: 200, body: state.recipes[recipeIndex] });
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
