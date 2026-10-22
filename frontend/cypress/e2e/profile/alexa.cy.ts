describe('Profile Alexa', () => {
  it('disconnects a connected Family Plus account', () => {
    cy.setFeatureFlags({ 'alexa-connection': true });
    cy.mockApi({ entitlementsProfile: 'premium', alexaConnected: true });
    cy.loginViaUi();
    cy.get('[data-testid="nav-profile"]').click();
    cy.location('pathname').should('eq', '/profile');
    cy.get('[data-testid="integrations-link"]').click();
    cy.location('pathname').should('eq', '/profile/integrations');
    cy.get('[data-testid="alexa-disconnect-button"]').should('be.visible').click();
    cy.contains('Echo devices will stop reading this meal diary.').should('be.visible');
    cy.get('[data-testid="alexa-disconnect-confirm"]').click();
    cy.wait('@apiDeleteAlexaLink');
    cy.contains('Not connected').should('be.visible');
    cy.get('[data-testid="alexa-disconnect-button"]').should('not.exist');
  });

  it('explains Family Plus and hides disconnect for a free family', () => {
    cy.setFeatureFlags({ 'alexa-connection': true });
    cy.mockApi({ entitlementsProfile: 'free' });
    cy.loginViaUi();
    cy.get('[data-testid="nav-profile"]').click();
    cy.get('[data-testid="integrations-link"]').click();
    cy.contains('Reading the meal diary on Alexa is part of Family Plus.').should('be.visible');
    cy.get('[data-testid="alexa-disconnect-button"]').should('not.exist');
    cy.get('[data-testid="alexa-upgrade-button"]').click();
    cy.get('[data-testid="paywall-modal"]').should('be.visible');
    cy.contains('Alexa is part of Family Plus').should('be.visible');
  });

  it('hides the Alexa section and plans row when the flag is off', () => {
    cy.setFeatureFlags({ 'alexa-connection': false });
    cy.mockApi({ entitlementsProfile: 'premium', alexaConnected: true });
    cy.loginViaUi();
    cy.get('[data-testid="nav-profile"]').click();
    cy.location('pathname').should('eq', '/profile');
    cy.get('[data-testid="leave-family-button"]').should('be.visible');
    cy.get('[data-testid="integrations-link"]').should('not.exist');
    cy.get('[data-testid="alexa-settings"]').should('not.exist');
    cy.visitApp('/profile/integrations');
    cy.get('[data-testid="integrations-empty"]').should('be.visible');
    cy.get('[data-testid="alexa-disconnect-button"]').should('not.exist');
    cy.visitApp('/plans');
    cy.contains("What's included").should('be.visible');
    cy.get('body').should('not.contain', 'Alexa meal diary');
  });

  it('shows the Alexa plans row when the flag is on', () => {
    cy.setFeatureFlags({ 'alexa-connection': true });
    cy.mockApi({ entitlementsProfile: 'premium' });
    cy.loginViaUi();
    cy.visitApp('/plans');
    cy.contains('Alexa meal diary').should('be.visible');
  });
});
