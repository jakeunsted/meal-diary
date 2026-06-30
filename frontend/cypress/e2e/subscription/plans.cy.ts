describe('Plans page', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.loginViaUi();
  });

  it('renders plan comparison for logged-in owners', () => {
    cy.visitApp('/plans');
    cy.contains('Family Plus plans').should('be.visible');
    cy.contains('What\'s included').should('be.visible');
    cy.contains('Start 7-day free trial').should('be.visible');
  });
});
