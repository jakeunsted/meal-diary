describe('Bottom navigation', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.loginViaUi();
    cy.location('pathname').should('eq', '/diary');
  });

  it('navigates between diary, recipes, shopping list and profile', () => {
    cy.get('[data-testid="nav-recipes"]').click();
    cy.location('pathname').should('eq', '/recipes');

    cy.get('[data-testid="nav-shopping-list"]').click();
    cy.location('pathname').should('eq', '/shopping-list');

    cy.get('[data-testid="nav-profile"]').click();
    cy.location('pathname').should('eq', '/profile');

    cy.get('[data-testid="nav-diary"]').click();
    cy.location('pathname').should('eq', '/diary');
  });
});
