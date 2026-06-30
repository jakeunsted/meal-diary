describe('Shopping list core', () => {
  beforeEach(() => {
    cy.visitShoppingList();
  });

  it('shows seeded active items', () => {
    cy.getActiveShoppingListItemNames().should('deep.equal', ['Tomatoes', 'Bread']);
  });

  it('adds and removes an item', () => {
    cy.addShoppingListItem('Milk');

    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Milk')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-remove-"]')
      .click({ force: true });
    cy.wait('@apiDeleteShoppingItem');

    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Milk')
      .should('not.exist');
  });
});
