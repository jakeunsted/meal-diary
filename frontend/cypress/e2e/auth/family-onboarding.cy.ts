describe('Family onboarding', () => {
  const navigateToFamilyStep = () => {
    cy.mockApi({ userWithoutFamilyGroup: true });
    cy.loginViaUi();
    cy.location('pathname').should('eq', '/registration/step-2');
  };

  it('creates a family group and redirects to diary', () => {
    navigateToFamilyStep();

    cy.get('[data-testid="family-tab-create"]').click();
    cy.get('[data-testid="family-create-name-input"]').type('My Cypress Family');
    cy.get('[data-testid="family-submit-button"]').click();

    cy.wait('@apiCreateFamilyGroup');
    cy.location('pathname').should('eq', '/diary');
    cy.get('[data-testid="diary-title"]').should('be.visible');
  });

  it('joins a family group and redirects to diary', () => {
    navigateToFamilyStep();

    cy.get('[data-testid="family-tab-join"]').click();
    cy.get('[data-testid="family-join-key-input"]').type('FAMILY-TEST-123');
    cy.get('[data-testid="family-submit-button"]').click();

    cy.wait('@apiJoinFamilyGroup');
    cy.location('pathname').should('eq', '/diary');
    cy.get('[data-testid="diary-title"]').should('be.visible');
  });

  it('shows an error when joining with an invalid family key', () => {
    navigateToFamilyStep();

    cy.get('[data-testid="family-tab-join"]').click();
    cy.get('[data-testid="family-join-key-input"]').type('NOT-FOUND');
    cy.get('[data-testid="family-submit-button"]').click();

    cy.wait('@apiJoinFamilyGroup');
    cy.location('pathname').should('eq', '/registration/step-2');
    cy.get('[data-testid="family-error-message"]').should('contain.text', 'Family group not found');
  });
});
