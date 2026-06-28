describe('Shopping list checking', () => {
  beforeEach(() => {
    cy.visitShoppingList();
  });

  it('moves a checked item into the checked section', () => {
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Tomatoes')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiUpdateShoppingItem');

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
    cy.wait('@apiUpdateShoppingItem');

    cy.expandCheckedShoppingListItems();
    cy.contains('[data-testid^="shopping-item-name-"]', 'Bread')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiUpdateShoppingItem');

    cy.get('[data-testid="shopping-list-checked-items-title"]').should('not.exist');
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Bread')
      .should('be.visible');
  });
});
