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
    const weekStart = '2026-05-18';
    cy.visitApp(`/diary?week=${weekStart}`);
    cy.wait('@apiGetMealDiary')
      .its('request.url')
      .should('include', `${weekStart}/daily-meals`);
    cy.location('search').should('include', `week=${weekStart}`);
    cy.get('[data-testid="day-food-plan-card"]').should('have.length.at.least', 7);
  });
});
