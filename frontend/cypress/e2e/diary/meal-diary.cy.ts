interface SyncFixtureSlot {
  id: number;
  meal_slot_id: number;
  name: string;
  position: number;
  dish: string | null;
  recipe_id: number | null;
  legacy_key: 'breakfast' | 'lunch' | 'dinner';
}

interface SyncFixtureDay {
  day_of_week: number;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  breakfast_recipe_id: number | null;
  lunch_recipe_id: number | null;
  dinner_recipe_id: number | null;
  slots: SyncFixtureSlot[];
  week_start_date: string;
}

interface SyncFixtureChange {
  day_of_week: number;
  meal_slot_id: number;
  dish: string | null;
  recipe_id: number | null;
  baseline?: { dish: string | null; recipe_id: number | null };
}

const clearPendingQueue = (win: Window) => {
  for (const key of Object.keys(win.localStorage)) {
    if (key.includes('mealDiaryPending')) {
      win.localStorage.removeItem(key);
    }
  }
};

const buildSyncWeek = (weekStartDate: string): SyncFixtureDay[] => {
  const slotTemplates = [
    { id: 1, name: 'Breakfast', position: 1, legacy_key: 'breakfast' as const },
    { id: 2, name: 'Lunch', position: 2, legacy_key: 'lunch' as const },
    { id: 3, name: 'Dinner', position: 3, legacy_key: 'dinner' as const },
  ];
  return Array.from({ length: 7 }, (_, index) => ({
    day_of_week: index + 1,
    breakfast: null,
    lunch: null,
    dinner: null,
    breakfast_recipe_id: null,
    lunch_recipe_id: null,
    dinner_recipe_id: null,
    slots: slotTemplates.map((slot) => ({
      id: 0,
      meal_slot_id: slot.id,
      name: slot.name,
      position: slot.position,
      dish: null,
      recipe_id: null,
      legacy_key: slot.legacy_key,
    })),
    week_start_date: weekStartDate,
  }));
};

const loginToDiary = () => {
  cy.visitApp('/login', {
    onBeforeLoad(win) {
      clearPendingQueue(win);
    },
  });
  cy.get('[data-testid="login-email-input"]').clear().type('user@example.com');
  cy.get('[data-testid="login-password-input"]').clear().type('password123');
  cy.get('[data-testid="login-submit-button"]').click();
  cy.wait('@apiLogin');
  cy.location('pathname').should('eq', '/diary');
};

describe('Meal diary', () => {
  beforeEach(() => {
    cy.mockApi();
    loginToDiary();
  });

  it('loads weekly day cards', () => {
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="day-food-plan-card"]').should('have.length.at.least', 7);
  });

  it('sets and persists a breakfast meal entry', () => {
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="set-meal-breakfast-button"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').type('Omelette');
    cy.get('[data-testid="set-meal-save-button"]').click();

    cy.wait('@apiPatchMealDiary');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');

    cy.reload();
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');
  });

  it('changes week using the week picker', () => {
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="week-next-button"]').click();
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="day-food-plan-card"]').should('have.length.at.least', 7);
    cy.location('search').should('include', 'week=');
  });

  it('clears a breakfast meal entry', () => {
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="set-meal-breakfast-button"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').type('Omelette');
    cy.get('[data-testid="set-meal-save-button"]').click();
    cy.wait('@apiPatchMealDiary');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');

    cy.get('[data-testid="breakfast-custom-badge"]').first().click();
    cy.get('[data-testid="set-meal-clear-button"]').click();
    cy.wait('@apiPatchMealDiary');
    cy.get('[data-testid="set-meal-breakfast-button"]').first().should('be.visible');
  });

  it('clears a breakfast meal entry by saving a blank name', () => {
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="set-meal-breakfast-button"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').type('Omelette');
    cy.get('[data-testid="set-meal-save-button"]').click();
    cy.wait('@apiPatchMealDiary');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');

    cy.get('[data-testid="breakfast-custom-badge"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').clear();
    cy.get('[data-testid="set-meal-clear-button"]').should('be.visible');
    cy.get('[data-testid="set-meal-save-button"]').should('not.be.disabled').click();
    cy.wait('@apiPatchMealDiary');
    cy.get('[data-testid="set-meal-breakfast-button"]').first().should('be.visible');
  });

  it('returns to this week via shortcut', () => {
    cy.wait('@apiGetMealDiary');
    cy.location('search').then((search) => {
      const originalWeek = new URLSearchParams(search).get('week');
      expect(originalWeek).to.be.a('string').and.not.be.empty;

      cy.get('[data-testid="week-next-button"]').click();
      cy.wait('@apiGetMealDiary');
      cy.get('[data-testid="week-this-week-button"]').should('be.visible').click();
      cy.wait('@apiGetMealDiary');
      cy.location('search').should('include', `week=${originalWeek}`);
    });
  });

  it('loads the week from the URL query param', () => {
    const frozenNow = new Date('2026-06-15T12:00:00');
    cy.clock(frozenNow, ['Date']);
    const weekStart = '2026-06-09';

    cy.intercept('GET', `**/api/meal-diaries/**/${weekStart}/daily-meals`).as('apiGetMealDiaryWeek');
    cy.visitApp(`/diary?week=${weekStart}`);
    cy.wait('@apiGetMealDiaryWeek')
      .its('request.url')
      .should('include', `${weekStart}/daily-meals`);
    cy.location('search').should('include', `week=${weekStart}`);
    cy.get('[data-testid="day-food-plan-card"]').should('have.length.at.least', 7);
  });

  it('opens diary settings and renames a meal slot', () => {
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="diary-settings-button"]').click();
    cy.wait('@apiGetMealSlots');
    cy.get('[data-testid="meal-slots-settings-modal"]').should('be.visible');
    cy.get('[data-testid="meal-slot-name-input-0"]').clear().type('Brunch');
    cy.get('[data-testid="meal-slots-save"]').click();
    cy.wait('@apiPutMealSlots');
    cy.get('[data-testid="meal-slots-settings-modal"]').should('not.be.visible');
  });

  it('warns when removing a meal slot that may clear future meals', () => {
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="diary-settings-button"]').click();
    cy.wait('@apiGetMealSlots');
    cy.get('[data-testid="meal-slot-remove-1"]').click();
    cy.get('[data-testid="meal-slots-save"]').click();
    cy.wait('@apiPutMealSlots');
    cy.get('[data-testid="meal-slots-removal-warning"]').should('be.visible');
    cy.get('[data-testid="meal-slots-save"]').click();
    cy.wait('@apiPutMealSlots');
  });

  it('saves an online meal with the day update when nothing is pending', () => {
    cy.wait('@apiGetMealDiary');
    let syncCount = 0;
    cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync$/, () => {
      syncCount += 1;
    });
    cy.get('[data-testid="set-meal-breakfast-button"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').type('Omelette');
    cy.get('[data-testid="set-meal-save-button"]').click();
    cy.wait('@apiPatchMealDiary');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');
    cy.then(() => {
      expect(syncCount).to.eq(0);
    });
  });

  it('opens a review when a failed save syncs into a conflict', () => {
    openConflictReview();
    cy.get('[data-testid="diary-sync-yours"]').should('contain.text', 'Omelette');
    cy.get('[data-testid="diary-sync-theirs"]').should('contain.text', 'Porridge');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');
    cy.get('[data-testid="diary-sync-pending"]').should('not.exist');
  });

  it('labels an empty server dish in the review', () => {
    openConflictReview(null);
    cy.get('[data-testid="diary-sync-theirs"]').should('contain.text', 'Empty');
  });

  it('keeps mine through the resolve request', () => {
    openConflictReview();
    cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync\/resolve$/, (req) => {
      expect(req.body.keep_mine).to.have.length(1);
      expect(req.body.keep_mine[0].dish).to.eq('Omelette');
      expect(req.body.keep_mine[0].expected).to.deep.eq({ dish: 'Porridge', recipe_id: null });
      req.reply({
        statusCode: 200,
        body: resolveAppliedBody(req.body),
      });
    }).as('apiResolveMealDiary');
    cy.get('[data-testid="diary-sync-keep-mine"]').click();
    cy.wait('@apiResolveMealDiary');
    cy.get('[data-testid="diary-sync-review"]').should('not.be.visible');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');
  });

  it('keeps theirs without another request', () => {
    openConflictReview();
    let resolveCount = 0;
    cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync\/resolve$/, () => {
      resolveCount += 1;
    });
    cy.get('[data-testid="diary-sync-keep-theirs"]').click();
    cy.get('[data-testid="diary-sync-review"]').should('not.be.visible');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Porridge');
    cy.then(() => {
      expect(resolveCount).to.eq(0);
    });
  });

  it('keeps all theirs and closes the review', () => {
    openConflictReview();
    cy.get('[data-testid="diary-sync-keep-all-theirs"]').click();
    cy.get('[data-testid="diary-sync-review"]').should('not.be.visible');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Porridge');
  });

  it('keeps the row open when resolve finds the server value moved', () => {
    openConflictReview();
    cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync\/resolve$/, (req) => {
      const slot = req.body.keep_mine[0];
      const days = buildSyncWeek(req.body.week_start_date);
      const day = days.find((entry) => entry.day_of_week === slot.day_of_week);
      const serverSlot = day?.slots.find((entry) => entry.meal_slot_id === slot.meal_slot_id);
      if (serverSlot) {
        serverSlot.dish = 'Stew';
      }
      req.reply({
        statusCode: 200,
        body: {
          dailyMeals: days,
          results: [{
            day_of_week: slot.day_of_week,
            meal_slot_id: slot.meal_slot_id,
            status: 'conflict',
            yours: { dish: 'Omelette', recipe_id: null },
            theirs: { dish: 'Stew', recipe_id: null },
            baseline: { dish: 'Porridge', recipe_id: null },
          }],
        },
      });
    }).as('apiResolveMealDiary');
    cy.get('[data-testid="diary-sync-keep-mine"]').click();
    cy.wait('@apiResolveMealDiary');
    cy.get('[data-testid="diary-sync-review"]').should('be.visible');
    cy.get('[data-testid="diary-sync-theirs"]').should('contain.text', 'Stew');
  });

  it('drops unresolved rows when the review is closed', () => {
    openConflictReview();
    cy.get('[data-testid="diary-sync-close"]').click();
    cy.get('[data-testid="diary-sync-review"]').should('not.be.visible');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Porridge');
  });

  it('drops unresolved rows when the review is dismissed with Escape', () => {
    openConflictReview();
    cy.get('[data-testid="diary-sync-review"]').type('{esc}');
    cy.get('[data-testid="diary-sync-review"]').should('not.be.visible');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Porridge');
  });

  it('drops unresolved conflicts when leaving the diary', () => {
    openConflictReview();
    cy.get('[data-testid="nav-recipes"]').click();
    cy.location('pathname').should('eq', '/recipes');
    cy.get('[data-testid="nav-diary"]').click();
    cy.location('pathname').should('eq', '/diary');
    cy.wait('@apiGetMealDiary');
    let syncAfterLeave = 0;
    cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync$/, () => {
      syncAfterLeave += 1;
    });
    cy.get('[data-testid="set-meal-breakfast-button"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').type('Toast');
    cy.get('[data-testid="set-meal-save-button"]').click();
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Toast');
    cy.then(() => {
      expect(syncAfterLeave).to.eq(0);
    });
  });

  it('does not open a review when the dish was already saved', () => {
    queueSaveAndSync('already_saved', 'Omelette');
    cy.get('[data-testid="diary-sync-review"]').should('not.be.visible');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');
    cy.get('[data-testid="diary-sync-pending"]').should('not.exist');
  });

  it('drops a removed slot without a review row', () => {
    queueSaveAndSync('slot_removed', null);
    cy.get('[data-testid="diary-sync-review"]').should('not.be.visible');
    cy.get('[data-testid="set-meal-breakfast-button"]').first().should('be.visible');
  });

  it('drops a rejected recipe without a review row', () => {
    queueSaveAndSync('recipe_rejected', null);
    cy.get('[data-testid="diary-sync-review"]').should('not.be.visible');
    cy.get('[data-testid="set-meal-breakfast-button"]').first().should('be.visible');
  });

  it('shows the past-week alert when sync is not allowed and keeps the queue', () => {
    cy.wait('@apiGetMealDiary');
    cy.intercept('PATCH', /\/api\/meal-diaries\/\d+\/daily-meals$/, { forceNetworkError: true });
    cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync$/, {
      statusCode: 403,
      body: {
        code: 'ENTITLEMENT_REQUIRED',
        feature: 'edit_past_weeks',
        plan: 'free',
        upgradeUrl: '/plans',
      },
    }).as('apiSyncMealDiary');
    cy.get('[data-testid="set-meal-breakfast-button"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').type('Omelette');
    cy.get('[data-testid="set-meal-save-button"]').click();
    cy.wait('@apiSyncMealDiary');
    cy.get('[data-testid="diary-week-read-only-alert"]').should('contain.text', 'view-only');
    cy.get('[data-testid="diary-sync-review"]').should('not.be.visible');
    cy.get('[data-testid="diary-sync-pending"]').should('be.visible');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');
  });

  it('shows the week-ahead alert when planning further ahead is not allowed', () => {
    cy.wait('@apiGetMealDiary');
    cy.intercept('PATCH', /\/api\/meal-diaries\/\d+\/daily-meals$/, { forceNetworkError: true });
    cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync$/, {
      statusCode: 403,
      body: {
        code: 'ENTITLEMENT_REQUIRED',
        feature: 'weeks_ahead',
        plan: 'free',
        upgradeUrl: '/plans',
      },
    }).as('apiSyncMealDiary');
    cy.get('[data-testid="set-meal-breakfast-button"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').type('Omelette');
    cy.get('[data-testid="set-meal-save-button"]').click();
    cy.wait('@apiSyncMealDiary');
    cy.get('[data-testid="diary-week-ahead-alert"]').should(
      'contain.text',
      'You can only plan one week ahead on the free plan.'
    );
    cy.get('[data-testid="diary-sync-review"]').should('not.be.visible');
    cy.get('[data-testid="diary-sync-pending"]').should('be.visible');
  });

  it('shows a retry when sync fails and sends the queue again', () => {
    cy.wait('@apiGetMealDiary');
    cy.intercept('PATCH', /\/api\/meal-diaries\/\d+\/daily-meals$/, { forceNetworkError: true });
    let attempts = 0;
    cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync$/, (req) => {
      attempts += 1;
      if (attempts === 1) {
        req.reply({ statusCode: 500, body: { message: 'Failed to sync daily meals' } });
        return;
      }
      req.reply({ statusCode: 200, body: syncBodyForRequest(req, 'applied', 'Omelette') });
    }).as('apiSyncMealDiary');
    cy.get('[data-testid="set-meal-breakfast-button"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').type('Omelette');
    cy.get('[data-testid="set-meal-save-button"]').click();
    cy.wait('@apiSyncMealDiary');
    cy.get('[data-testid="diary-sync-failed"]').should('be.visible');
    cy.get('[data-testid="diary-sync-pending"]').should('be.visible');
    cy.get('[data-testid="diary-sync-retry"]').click();
    cy.wait('@apiSyncMealDiary');
    cy.get('[data-testid="diary-sync-failed"]').should('not.exist');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');
  });

  it('queues offline edits and syncs them when the browser is online again', () => {
    let online = false;
    cy.visitApp('/diary', {
      onBeforeLoad(win) {
        Object.defineProperty(win.navigator, 'onLine', {
          configurable: true,
          get() {
            return online;
          },
        });
      },
    });
    cy.wait('@apiGetMealDiary');
    cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync$/, (req) => {
      expect(req.body.slots).to.have.length(2);
      req.reply({ statusCode: 200, body: syncBodyForRequest(req, 'conflict', 'Porridge') });
    }).as('apiSyncMealDiary');

    cy.get('[data-testid="set-meal-breakfast-button"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').type('Omelette');
    cy.get('[data-testid="set-meal-save-button"]').click();
    cy.get('[data-testid="set-meal-lunch-button"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').type('Soup');
    cy.get('[data-testid="set-meal-save-button"]').click();
    cy.get('[data-testid="diary-sync-pending"]').should('be.visible');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');

    cy.window().then((win) => {
      online = true;
      win.dispatchEvent(new Event('online'));
    });
    cy.wait('@apiSyncMealDiary');
    cy.get('[data-testid="diary-sync-review"]').should('be.visible');
    cy.get('[data-testid="diary-sync-row"]').should('have.length', 2);

    cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync\/resolve$/, (req) => {
      expect(req.body.keep_mine).to.have.length(2);
      req.reply({ statusCode: 200, body: resolveAppliedBody(req.body) });
    }).as('apiResolveMealDiary');
    cy.get('[data-testid="diary-sync-keep-all-mine"]').click();
    cy.wait('@apiResolveMealDiary');
    cy.get('[data-testid="diary-sync-review"]').should('not.be.visible');
  });

  it('flushes the queue when the diary tab becomes visible', () => {
    let online = false;
    cy.visitApp('/diary', {
      onBeforeLoad(win) {
        Object.defineProperty(win.navigator, 'onLine', {
          configurable: true,
          get() {
            return online;
          },
        });
      },
    });
    cy.wait('@apiGetMealDiary');
    cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync$/, (req) => {
      req.reply({ statusCode: 200, body: syncBodyForRequest(req, 'applied', 'Omelette') });
    }).as('apiSyncMealDiary');
    cy.get('[data-testid="set-meal-breakfast-button"]').first().click();
    cy.get('[data-testid="set-meal-name-input"]').type('Omelette');
    cy.get('[data-testid="set-meal-save-button"]').click();
    cy.get('[data-testid="diary-sync-pending"]').should('be.visible');
    cy.window().then((win) => {
      online = true;
      win.document.dispatchEvent(new Event('visibilitychange'));
    });
    cy.wait('@apiSyncMealDiary');
    cy.get('[data-testid="breakfast-custom-badge"]').first().should('contain.text', 'Omelette');
    cy.get('[data-testid="diary-sync-pending"]').should('not.exist');
  });
});

const applyServerDish = (days: SyncFixtureDay[], slot: SyncFixtureChange, dish: string | null) => {
  const day = days.find((entry) => entry.day_of_week === slot.day_of_week);
  const serverSlot = day?.slots.find((entry) => entry.meal_slot_id === slot.meal_slot_id);
  if (!day || !serverSlot) {
    return;
  }
  serverSlot.dish = dish;
  day[serverSlot.legacy_key] = dish;
};

const syncBodyForRequest = (
  req: { body: { week_start_date: string; slots: SyncFixtureChange[] } },
  status: string,
  serverDish: string | null
) => {
  const days = buildSyncWeek(req.body.week_start_date);
  const results = req.body.slots.map((slot) => {
    applyServerDish(days, slot, serverDish);
    return {
      day_of_week: slot.day_of_week,
      meal_slot_id: slot.meal_slot_id,
      status,
      ...(status === 'conflict'
        ? {
            yours: { dish: slot.dish, recipe_id: slot.recipe_id ?? null },
            theirs: { dish: serverDish, recipe_id: null },
            baseline: slot.baseline,
          }
        : {}),
    };
  });
  return { dailyMeals: days, results };
};

const resolveAppliedBody = (body: { week_start_date: string; keep_mine: SyncFixtureChange[] }) => {
  const days = buildSyncWeek(body.week_start_date);
  const results = body.keep_mine.map((slot) => {
    applyServerDish(days, slot, slot.dish);
    return {
      day_of_week: slot.day_of_week,
      meal_slot_id: slot.meal_slot_id,
      status: 'applied',
    };
  });
  return { dailyMeals: days, results };
};

const ignoreFetchFailures = () => {
  cy.on('uncaught:exception', (err) => {
    if (/failed to fetch|network/i.test(err.message)) {
      return false;
    }
    return true;
  });
};

const openConflictReview = (serverDish: string | null = 'Porridge') => {
  queueSaveAndSync('conflict', serverDish);
  cy.get('[data-testid="diary-sync-review"]').should('be.visible');
};

const queueSaveAndSync = (status: string, serverDish: string | null) => {
  cy.wait('@apiGetMealDiary');
  ignoreFetchFailures();
  let failPatch = true;
  cy.intercept('PATCH', /\/api\/meal-diaries\/\d+\/daily-meals$/, (req) => {
    if (failPatch) {
      failPatch = false;
      req.reply({ forceNetworkError: true });
      return;
    }
    req.reply({ statusCode: 200, body: { data: req.body } });
  });
  cy.intercept('POST', /\/api\/meal-diaries\/\d+\/daily-meals\/sync$/, (req) => {
    req.reply({ statusCode: 200, body: syncBodyForRequest(req, status, serverDish) });
  }).as('apiSyncMealDiary');
  cy.get('[data-testid="set-meal-breakfast-button"]').first().click();
  cy.get('[data-testid="set-meal-name-input"]').type('Omelette');
  cy.get('[data-testid="set-meal-save-button"]').click();
  cy.wait('@apiSyncMealDiary');
};
