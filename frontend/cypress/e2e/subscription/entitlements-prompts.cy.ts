describe('Entitlements prompts', () => {
  it('shows the trial expired modal for owners', () => {
    cy.mockApi({ entitlementsProfile: 'trialExpired' });
    cy.loginViaUi();
    cy.wait('@apiGetEntitlements');
    cy.get('[data-testid="trial-expired-modal"]').should('be.visible');
    cy.get('[data-testid="trial-expired-dismiss"]').click();
    cy.wait('@apiDismissEntitlementPrompt');
    cy.get('[data-testid="trial-expired-modal"]').should('not.have.class', 'modal-open');
  });

  it('shows the payment failed banner for owners', () => {
    cy.mockApi({ entitlementsProfile: 'paymentFailed' });
    cy.loginViaUi();
    cy.wait('@apiGetEntitlements');
    cy.get('[data-testid="payment-failed-banner"]').should('be.visible');
    cy.contains('Payment failed').should('be.visible');
  });
});
