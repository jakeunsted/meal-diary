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

  it('shows the custom meal names dialog instead of the trial dialog for an expired owner', () => {
    cy.mockApi({ entitlementsProfile: 'customMealNamesLapse' });
    cy.loginViaUi();
    cy.wait('@apiGetEntitlements');
    cy.get('[data-testid="custom-meal-names-lapse-modal"]').should('be.visible');
    cy.get('[data-testid="custom-meal-names-lapse-title"]').should('contain.text', 'Renew to keep your meal names');
    cy.get('[data-testid="custom-meal-names-lapse-renew"]').should('be.visible');
    cy.get('[data-testid="trial-expired-modal"]').should('not.have.class', 'modal-open');
  });

  it('resets meal names when the owner chooses not now', () => {
    const today = new Date();
    const expectedToday = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    cy.mockApi({ entitlementsProfile: 'customMealNamesLapse' });
    cy.loginViaUi();
    cy.wait('@apiGetEntitlements');
    cy.get('[data-testid="custom-meal-names-lapse-not-now"]').click();
    cy.wait('@apiResetMealSlots').its('request.body').should('deep.equal', { today: expectedToday });
    cy.get('[data-testid="custom-meal-names-lapse-modal"]').should('not.have.class', 'modal-open');
    cy.get('[data-testid="trial-expired-modal"]').should('not.have.class', 'modal-open');
    cy.get('@apiDismissEntitlementPrompt.all').should('have.length', 0);
  });

  it('keeps the custom meal names dialog open when the reset fails', () => {
    cy.mockApi({ entitlementsProfile: 'customMealNamesLapse', failResetMealSlots: true });
    cy.loginViaUi();
    cy.wait('@apiGetEntitlements');
    cy.get('[data-testid="custom-meal-names-lapse-not-now"]').click();
    cy.wait('@apiResetMealSlots');
    cy.get('[data-testid="custom-meal-names-lapse-modal"]').should('be.visible');
    cy.get('[data-testid="custom-meal-names-lapse-error"]').should(
      'contain.text',
      "Couldn't update your meal names. Nothing was changed. Try again."
    );
    cy.get('[data-testid="custom-meal-names-lapse-not-now"]').should('not.be.disabled');
  });

  it('hides the custom meal names dialog for this visit for a non-owner', () => {
    cy.mockApi({ entitlementsProfile: 'customMealNamesLapseNonOwner' });
    cy.loginViaUi();
    cy.wait('@apiGetEntitlements');
    cy.get('[data-testid="custom-meal-names-lapse-modal"]').should('be.visible');
    cy.get('[data-testid="custom-meal-names-lapse-description"]').should(
      'contain.text',
      'Ask Alex to renew Family Plus'
    );
    cy.get('[data-testid="custom-meal-names-lapse-renew"]').should('not.exist');
    cy.get('[data-testid="custom-meal-names-lapse-not-now"]').click();
    cy.get('@apiResetMealSlots.all').should('have.length', 0);
    cy.get('[data-testid="custom-meal-names-lapse-modal"]').should('not.have.class', 'modal-open');
    cy.reload();
    cy.get('[data-testid="custom-meal-names-lapse-modal"]', { timeout: 10000 }).should('be.visible');
    cy.get('@apiResetMealSlots.all').should('have.length', 0);
  });

  it('does not show the custom meal names dialog when payment failed', () => {
    cy.mockApi({ entitlementsProfile: 'paymentFailed' });
    cy.loginViaUi();
    cy.wait('@apiGetEntitlements');
    cy.get('[data-testid="payment-failed-banner"]').should('be.visible');
    cy.get('[data-testid="custom-meal-names-lapse-modal"]').should('not.have.class', 'modal-open');
  });

  it('does not show the custom meal names dialog while the family is still premium', () => {
    cy.mockApi({ entitlementsProfile: 'premium' });
    cy.loginViaUi();
    cy.wait('@apiGetEntitlements');
    cy.get('[data-testid="custom-meal-names-lapse-modal"]').should('not.have.class', 'modal-open');
  });

  it('does not show the custom meal names dialog when meal names are already the defaults', () => {
    cy.mockApi({ entitlementsProfile: 'alreadyDefault' });
    cy.loginViaUi();
    cy.wait('@apiGetEntitlements');
    cy.get('[data-testid="custom-meal-names-lapse-modal"]').should('not.have.class', 'modal-open');
    cy.get('[data-testid="trial-expired-modal"]').should('not.have.class', 'modal-open');
  });
});
