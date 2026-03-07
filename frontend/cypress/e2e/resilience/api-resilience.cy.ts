describe('API resilience and auth handling', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.loginViaUi();
    cy.location('pathname').should('eq', '/diary');
  });

  it('shows an error toast for non-auth API failures', () => {
    cy.intercept('GET', /\/api\/recipes\/family\/\d+(\?.*)?$/, {
      statusCode: 500,
      body: {
        message: 'Recipes service unavailable',
      },
    }).as('apiGetRecipes');

    cy.get('[data-testid="nav-recipes"]').click();
    cy.wait('@apiGetRecipes');
    cy.contains('Recipes service unavailable').should('be.visible');
  });

  it('automatically logs out on auth errors', () => {
    cy.intercept('GET', /\/api\/recipes\/family\/\d+(\?.*)?$/, {
      statusCode: 401,
      body: {
        message: 'Invalid token',
      },
    }).as('apiGetRecipes');

    cy.get('[data-testid="nav-recipes"]').click();
    cy.wait('@apiGetRecipes');
    cy.location('pathname').should('eq', '/login');
  });
});
