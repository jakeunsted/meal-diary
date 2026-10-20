const alexaLinkPath = `/alexa/link?response_type=code&client_id=test-client&redirect_uri=${encodeURIComponent('https://pitangui.amazon.com/api/skill/link/test')}&state=state-123&scope=meal-diary:read`;

describe('Alexa link', () => {
  it('shows the sign-in form when signed out', () => {
    cy.setFeatureFlags({ 'alexa-connection': true });
    cy.mockApi();
    cy.visitApp(alexaLinkPath);
    cy.get('[data-testid="alexa-link-email"]').should('be.visible');
    cy.get('[data-testid="alexa-link-password"]').should('be.visible');
    cy.get('[data-testid="alexa-link-submit"]').should('be.visible');
    cy.get('[data-testid="alexa-allow-button"]').should('not.exist');
  });

  it('shows an invalid request when the Alexa query is missing', () => {
    cy.setFeatureFlags({ 'alexa-connection': true });
    cy.mockApi();
    cy.visitApp('/alexa/link');
    cy.get('[data-testid="alexa-invalid-request"]').should('be.visible');
    cy.get('[data-testid="alexa-allow-button"]').should('not.exist');
    cy.get('[data-testid="alexa-link-email"]').should('not.exist');
  });

  it('asks for a family after sign-in when the account has none', () => {
    cy.setFeatureFlags({ 'alexa-connection': true });
    cy.mockApi({ userWithoutFamilyGroup: true });
    cy.visitApp(alexaLinkPath);
    cy.get('[data-testid="alexa-link-email"]').type('user@example.com');
    cy.get('[data-testid="alexa-link-password"]').type('password123');
    cy.get('[data-testid="alexa-link-submit"]').click();
    cy.wait('@apiLogin');
    cy.contains('Join or create a family before connecting Alexa.').should('be.visible');
    cy.get('[data-testid="alexa-family-link"]').should('have.attr', 'href', '/registration/step-2');
    cy.get('[data-testid="alexa-allow-button"]').should('not.exist');
  });

  it('refuses allow when the family is not on Family Plus', () => {
    cy.setFeatureFlags({ 'alexa-connection': true });
    cy.mockApi({ entitlementsProfile: 'free' });
    cy.loginViaUi();
    cy.visitApp(alexaLinkPath);
    cy.contains("Alexa can read this family's meal diary with Family Plus.").should('be.visible');
    cy.get('[data-testid="alexa-upgrade-link"]').should('be.visible');
    cy.get('[data-testid="alexa-allow-button"]').should('not.exist');
  });

  it('posts authorize and follows the redirect when the family has Alexa', () => {
    cy.setFeatureFlags({ 'alexa-connection': true });
    cy.mockApi({ entitlementsProfile: 'premium' });
    cy.intercept('POST', '/api/alexa/oauth/authorize', (req) => {
      expect(req.body.clientId).to.eq('test-client');
      expect(req.body.redirectUri).to.eq('https://pitangui.amazon.com/api/skill/link/test');
      expect(req.body.state).to.eq('state-123');
      expect(req.body.scope).to.eq('meal-diary:read');
      expect(req.body.responseType).to.eq('code');
      req.reply({
        statusCode: 200,
        body: { redirectUrl: '/alexa/link?linked=1' },
      });
    }).as('apiAuthorizeAlexa');
    cy.loginViaUi();
    cy.visitApp(alexaLinkPath);
    cy.contains('Test Family Group').should('be.visible');
    cy.get('[data-testid="alexa-allow-button"]').click();
    cy.wait('@apiAuthorizeAlexa');
    cy.location('search').should('include', 'linked=1');
  });

  it('shows unavailable and no allow button when the flag is off', () => {
    cy.setFeatureFlags({ 'alexa-connection': false });
    cy.mockApi();
    cy.visitApp(alexaLinkPath);
    cy.get('[data-testid="alexa-link-unavailable"]').should('be.visible');
    cy.contains("Meal Diary on Alexa isn't available.").should('be.visible');
    cy.get('[data-testid="alexa-allow-button"]').should('not.exist');
    cy.get('[data-testid="alexa-link-email"]').should('not.exist');
  });
});
