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
  });
});
