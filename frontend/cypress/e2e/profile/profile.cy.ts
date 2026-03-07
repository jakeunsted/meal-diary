describe('Profile', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.loginViaUi();
    cy.get('[data-testid="nav-profile"]').click();
    cy.location('pathname').should('eq', '/profile');
    cy.wait('@apiGetFamilyGroup');
    cy.wait('@apiGetFamilyMembers');
  });

  it('copies the family group code', () => {
    cy.get('[data-testid="profile-family-code"]').click();
    cy.contains('Family code copied to clipboard!').should('be.visible');
  });

  it('opens invite modal and copies invite link', () => {
    cy.get('[data-testid="profile-add-family-member-button"]').click();
    cy.get('[data-testid="profile-invite-link-input"]').should('be.visible');
    cy.get('[data-testid="profile-copy-invite-link-button"]').click();
    cy.get('[data-testid="profile-copy-invite-link-button"]').should('not.be.disabled');
  });
});
