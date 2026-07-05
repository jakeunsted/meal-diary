const getCurrentMonday = (referenceDate = new Date()) => {
  const date = new Date(referenceDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatWeekKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekKeyAhead = (weeksAhead: number) => {
  const monday = getCurrentMonday();
  monday.setDate(monday.getDate() + weeksAhead * 7);
  return formatWeekKey(monday);
};

describe('Entitlements diary', () => {
  beforeEach(() => {
    cy.mockApi({ entitlementsProfile: 'free' });
    cy.loginViaUi();
    cy.wait('@apiGetEntitlements');
    cy.location('pathname').should('eq', '/diary');
  });

  it('blocks navigating beyond the free planning horizon', () => {
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="week-next-button"]').click();
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="week-next-button"]').should('be.disabled');
  });

  it('blocks viewing beyond the free planning horizon from the API', () => {
    const blockedWeekKey = getWeekKeyAhead(2);
    cy.visitApp(`/diary?week=${blockedWeekKey}`);
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="paywall-modal"]').should('be.visible');
  });

  it('shows read-only state for past weeks', () => {
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="week-previous-button"]').click();
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="diary-week-read-only-alert"]').should('be.visible');
    cy.get('[data-testid="diary-week-read-only-upgrade"]').should('be.visible').and('have.attr', 'href', '/plans');
    cy.get('[data-testid="set-meal-breakfast-button"]').should('not.exist');
  });
});

describe('Entitlements diary clamping', () => {
  it('clamps back to the current week after entitlements load', () => {
    cy.mockApi({ entitlementsProfile: 'free' });
    cy.intercept('GET', /\/api\/family-groups\/\d+\/entitlements$/, (req) => {
      req.reply({
        delay: 1500,
        statusCode: 200,
        body: {
          plan: 'free',
          status: 'active',
          isComplimentary: false,
          features: {
            family_members: true,
            weeks_ahead: true,
            edit_past_weeks: false,
            recipes: true,
            recipe_to_shopping_list: false,
          },
          limits: {
            maxFamilyMembers: 2,
            maxRecipes: 10,
            maxWeeksAhead: 1,
            canEditPastWeeks: false,
            canAddRecipeToShoppingList: false,
          },
          usage: {
            familyMemberCount: 1,
            recipeCount: 1,
          },
          prompts: {
            trialExpired: false,
            paymentFailed: false,
            paymentFailedUntil: null,
          },
          billing: {
            isOwner: true,
            ownerDisplayName: 'Meal',
            trialAvailable: true,
            storePlatform: null,
          },
        },
      });
    }).as('apiGetEntitlementsDelayed');

    cy.loginViaUi();
    cy.visitApp('/diary');
    cy.get('[data-testid="week-next-button"]').click({ force: true });
    cy.get('[data-testid="week-next-button"]').click({ force: true });
    cy.get('[data-testid="week-this-week-button"]').should('be.visible');
    cy.wait('@apiGetEntitlementsDelayed');
    cy.get('[data-testid="week-this-week-button"]').should('not.exist');
  });
});
