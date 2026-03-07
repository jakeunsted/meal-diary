describe('Auth and access control', () => {
  beforeEach(() => {
    cy.mockApi();
  });

  it('redirects unauthenticated users from protected routes to login', () => {
    cy.visitApp('/diary');
    cy.location('pathname').should('eq', '/login');
    cy.get('[data-testid="login-form"]').should('be.visible');
  });

  it('logs in and redirects users with a family group to diary', () => {
    cy.loginViaUi();
    cy.location('pathname').should('eq', '/diary');
    cy.get('[data-testid="diary-title"]').should('contain.text', 'Meal diary');
  });

  it('redirects users without a family group to registration step 2', () => {
    cy.mockApi({ userWithoutFamilyGroup: true });
    cy.loginViaUi();
    cy.location('pathname').should('eq', '/registration/step-2');
    cy.get('[data-testid="family-submit-button"]').should('be.visible');
  });

  it('shows an error message when credentials are invalid', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 403,
      body: {
        message: 'Invalid credentials',
      },
    }).as('apiLogin');

    cy.visitApp('/login');
    cy.get('[data-testid="login-email-input"]').type('user@example.com');
    cy.get('[data-testid="login-password-input"]').type('wrong-password');
    cy.get('[data-testid="login-submit-button"]').click();

    cy.wait('@apiLogin');
    cy.location('pathname').should('eq', '/login');
    cy.contains('Invalid credentials').should('be.visible');
  });

  it('redirects authenticated users away from login', () => {
    cy.loginViaUi();
    cy.location('pathname').should('eq', '/diary');
    cy.visitApp('/login');
    cy.location('pathname').should('eq', '/diary');
  });
});
