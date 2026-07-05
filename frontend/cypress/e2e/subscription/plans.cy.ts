describe('Plans page', () => {
  describe('free owners', () => {
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

    it('returns to the previous app page instead of Stripe history', () => {
      cy.visitApp('/profile');
      cy.visitApp('/plans');
      cy.contains('Back').click();
      cy.location('pathname').should('eq', '/profile');
    });

    it('preserves the stored return path after a Stripe redirect', () => {
      cy.visitApp('/profile');
      cy.visitApp('/plans');
      cy.window().then((win) => {
        expect(win.sessionStorage.getItem('plansReturnPath')).to.eq('/profile');
      });
      cy.visitApp('/plans?session_id=cs_test');
      cy.window().then((win) => {
        expect(win.sessionStorage.getItem('plansReturnPath')).to.eq('/profile');
      });
      cy.contains('Back').click();
      cy.location('pathname').should('eq', '/profile');
    });
  });

  describe('premium owners', () => {
    beforeEach(() => {
      cy.mockApi({ entitlementsProfile: 'premium' });
      cy.loginViaUi();
    });

    it('shows manage billing instead of purchase buttons', () => {
      cy.visitApp('/plans');
      cy.contains('Manage billing').should('be.visible');
      cy.contains('Start 7-day free trial').should('not.exist');
      cy.contains('Subscribe now').should('not.exist');
    });
  });
});
