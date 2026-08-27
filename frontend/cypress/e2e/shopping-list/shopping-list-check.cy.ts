describe('Shopping list checking', () => {
  beforeEach(() => {
    cy.visitShoppingList();
  });

  it('moves a checked item into the checked section', () => {
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Tomatoes')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');

    cy.get('[data-testid="shopping-list-checked-items-title"]').should('contain.text', '(1)');
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Tomatoes')
      .should('not.exist');
    cy.expandCheckedShoppingListItems();
    cy.contains('[data-testid^="shopping-item-name-"]', 'Tomatoes').should('be.visible');
  });

  it('unchecks an item back into the active list', () => {
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Bread')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');

    cy.expandCheckedShoppingListItems();
    cy.contains('[data-testid^="shopping-item-name-"]', 'Bread')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');

    cy.get('[data-testid="shopping-list-checked-items-title"]').should('not.exist');
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Bread')
      .should('be.visible');
  });

  it('unchecks all checked items from the checked section', () => {
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Tomatoes')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');

    cy.get('[data-testid="shopping-list-uncheck-all"]').click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');

    cy.get('[data-testid="shopping-list-checked-items-title"]').should('not.exist');
    cy.getActiveShoppingListItemNames().should('deep.equal', ['Tomatoes', 'Bread']);
  });

  it('restores unchecked items with the Undo action', () => {
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Tomatoes')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');

    cy.get('[data-testid="shopping-list-uncheck-all"]').click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');
    cy.get('[data-testid="shopping-list-checked-items-title"]').should('not.exist');

    cy.get('[data-testid="toast-action-button"]').click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');

    cy.get('[data-testid="shopping-list-checked-items-title"]').should('contain.text', '(1)');
  });

  it('deletes all checked items from the checked section', () => {
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Tomatoes')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');

    cy.get('[data-testid="shopping-list-delete-all-checked"]').click({ force: true });
    cy.wait('@apiBulkDeleteShoppingItems');

    cy.get('[data-testid="shopping-list-checked-items-title"]').should('not.exist');
    cy.getActiveShoppingListItemNames().should('deep.equal', ['Bread']);
  });

  it('restores deleted items with the Undo action', () => {
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Tomatoes')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');

    cy.get('[data-testid="shopping-list-delete-all-checked"]').click({ force: true });
    cy.wait('@apiBulkDeleteShoppingItems');
    cy.getActiveShoppingListItemNames().should('deep.equal', ['Bread']);

    cy.get('[data-testid="toast-action-button"]').click({ force: true });
    cy.wait('@apiBulkUpdateShoppingItems');

    cy.get('[data-testid="shopping-list-checked-items-title"]').should('contain.text', '(1)');
  });
});
