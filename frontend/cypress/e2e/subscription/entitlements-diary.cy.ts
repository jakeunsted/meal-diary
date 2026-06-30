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

  it('shows read-only state for past weeks', () => {
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="week-previous-button"]').click();
    cy.wait('@apiGetMealDiary');
    cy.get('[data-testid="diary-week-read-only-alert"]').should('be.visible');
    cy.get('[data-testid="diary-week-read-only-upgrade"]').should('be.visible').and('have.attr', 'href', '/plans');
    cy.get('[data-testid="set-meal-breakfast-button"]').should('not.exist');
  });
});
