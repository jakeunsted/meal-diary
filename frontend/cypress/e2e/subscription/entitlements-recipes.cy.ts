describe('Entitlements recipes', () => {
  beforeEach(() => {
    cy.mockApi({ entitlementsProfile: 'freeRecipeLimit' });
    cy.loginViaUi();
    cy.wait('@apiGetEntitlements');
    cy.get('[data-testid="nav-recipes"]').click();
    cy.location('pathname').should('eq', '/recipes');
    cy.wait('@apiGetRecipes');
  });

  it('disables new recipe creation at the free limit', () => {
    cy.get('[data-testid="recipes-limit-alert"]').should('be.visible');
    cy.get('[data-testid="recipes-new-button"]').should('be.disabled');
  });

  it('gates add to shopping list on recipe detail', () => {
    cy.get('[data-testid^="recipe-card-"]').first().click();
    cy.location('pathname').should('match', /\/recipes\/\d+$/);
    cy.get('[data-testid="recipe-add-to-shopping-list-button"]').should('be.disabled');
    cy.get('[data-testid="recipe-shopping-list-premium-hint"]').should('be.visible');
  });
});
