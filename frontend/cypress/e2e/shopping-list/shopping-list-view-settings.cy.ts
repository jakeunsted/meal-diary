describe('Shopping list view settings', () => {
  beforeEach(() => {
    cy.visitShoppingList();
  });

  it('hides the checked items section when "Hide checked items" is enabled', () => {
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Tomatoes')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');

    cy.get('[data-testid="shopping-list-checked-items-title"]').should('exist');

    cy.get('[data-testid="shopping-list-settings-button"]').click({ force: true });
    cy.get('[data-testid="shopping-list-hide-checked-toggle"]').check({ force: true });

    cy.get('[data-testid="shopping-list-checked-items-title"]').should('not.exist');

    cy.get('[data-testid="shopping-list-hide-checked-toggle"]').uncheck({ force: true });
    cy.get('[data-testid="shopping-list-checked-items-title"]').should('exist');
  });

  it('hides the item checkboxes when "Hide checkboxes" is enabled', () => {
    cy.get('[data-testid="shopping-list-settings-button"]').click({ force: true });
    cy.get('[data-testid="shopping-list-hide-checkboxes-toggle"]').check({ force: true });

    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Tomatoes')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .should('not.be.visible');
  });
});
