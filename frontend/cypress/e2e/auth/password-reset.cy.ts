describe('Password reset', () => {
  beforeEach(() => {
    cy.mockApi();
  });

  it('links to forgot password from login', () => {
    cy.visitApp('/login');
    cy.get('[data-testid="forgot-password-link"]').click();
    cy.location('pathname').should('eq', '/forgot-password');
    cy.get('[data-testid="forgot-password-form"]').should('be.visible');
  });

  it('shows confirmation after requesting a reset', () => {
    cy.intercept('POST', '/api/auth/forgot-password', {
      statusCode: 200,
      body: {
        message: 'If an account exists for that email, we sent password reset instructions.',
      },
    }).as('forgotPassword');

    cy.visitApp('/forgot-password');
    cy.get('[data-testid="forgot-password-email-input"]').type('user@example.com');
    cy.get('[data-testid="forgot-password-submit-button"]').click();

    cy.wait('@forgotPassword');
    cy.get('[data-testid="forgot-password-success"]').should('be.visible');
  });

  it('resets the password with a token and returns to login', () => {
    cy.intercept('POST', '/api/auth/reset-password', {
      statusCode: 200,
      body: { message: 'Password updated' },
    }).as('resetPassword');

    cy.visitApp('/reset-password?token=test-token');
    cy.get('[data-testid="reset-password-input"]').type('NewPassword1!');
    cy.get('[data-testid="reset-confirm-password-input"]').type('NewPassword1!');
    cy.get('[data-testid="reset-password-submit-button"]').click();

    cy.wait('@resetPassword').its('request.body').should('deep.equal', {
      token: 'test-token',
      password: 'NewPassword1!',
    });
    cy.location('pathname').should('eq', '/login');
    cy.location('search').should('contain', 'reset=1');
    cy.get('[data-testid="password-reset-alert"]').should('be.visible');
  });

  it('shows an error when the reset token is invalid', () => {
    cy.intercept('POST', '/api/auth/reset-password', {
      statusCode: 400,
      body: { message: 'Reset link is invalid or has expired' },
    }).as('resetPassword');

    cy.visitApp('/reset-password?token=bad-token');
    cy.get('[data-testid="reset-password-input"]').type('NewPassword1!');
    cy.get('[data-testid="reset-confirm-password-input"]').type('NewPassword1!');
    cy.get('[data-testid="reset-password-submit-button"]').click();

    cy.wait('@resetPassword');
    cy.get('[data-testid="reset-password-error"]').should('contain.text', 'Reset link is invalid or has expired');
    cy.location('pathname').should('eq', '/reset-password');
  });
});
