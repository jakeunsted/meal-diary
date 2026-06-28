describe('Plans page trial-exhausted checkout', () => {
  beforeEach(() => {
    cy.mockApi({ entitlementsProfile: 'trialExhausted' });
    cy.loginViaUi();
  });

  it('shows paid checkout CTA when trial is unavailable', () => {
    cy.visitApp('/plans');
    cy.contains('Subscribe now').should('be.visible');
    cy.contains('Start 7-day free trial').should('not.exist');
    cy.contains('7-day free trial').should('not.exist');
  });

  it('starts checkout without blocking trial-exhausted owners', () => {
    cy.visitApp('/plans');

    cy.window().then((win) => {
      cy.stub(win, 'open').as('windowOpen');
      Object.defineProperty(win, 'location', {
        configurable: true,
        value: { ...win.location, href: '' },
      });
    });

    cy.contains('button', 'Subscribe now').first().click();
    cy.wait('@apiCreateCheckoutSession').its('request.body').should('include', {
      family_group_id: 1,
      interval: 'month',
    });
  });
});
