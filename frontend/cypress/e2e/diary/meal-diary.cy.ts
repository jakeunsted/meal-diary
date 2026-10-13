describe('Meal diary', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.loginViaUi();
    cy.location('pathname').should('eq', '/diary');
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
});
