describe('Shopping list drag and drop', () => {
  beforeEach(() => {
    cy.visitShoppingList();
  });

  it('reorders active items when dragging below another row', () => {
    cy.addShoppingListItem('Cheese');

    cy.getActiveShoppingListItemNames().should('deep.equal', ['Tomatoes', 'Bread', 'Cheese']);

    cy.dragShoppingListItem('Cheese', 'Tomatoes', { below: false });
    cy.wait('@apiReorderShoppingItems');

    cy.getActiveShoppingListItemNames().should('deep.equal', ['Cheese', 'Tomatoes', 'Bread']);
  });

  it('nests an item under a parent when dragging onto the right side of a row', () => {
    cy.addShoppingListItem('Cheese');

    cy.dragShoppingListItem('Cheese', 'Tomatoes', { nest: true });
    cy.wait('@apiReorderShoppingItems').then((interception) => {
      const cheeseChange = interception.request.body.items.find((item: { id: number }) => item.id === 2000);
      expect(cheeseChange.parent_item_id).to.eq(1001);
    });

    cy.get('[data-testid="shopping-list-item-row-2000"]')
      .should('have.attr', 'style')
      .and('include', 'margin-left: 1.5rem');
  });

  it('moves a nested item back to the root when dragged between top-level rows', () => {
    cy.addShoppingListItem('Cheese');

    cy.dragShoppingListItem('Cheese', 'Bread', { nest: true });
    cy.wait('@apiReorderShoppingItems');

    cy.get('[data-testid="shopping-list-item-row-2000"]')
      .should('have.attr', 'style')
      .and('include', 'margin-left: 1.5rem');

    cy.dragShoppingListItem('Cheese', 'Tomatoes', { below: true });
    cy.wait('@apiReorderShoppingItems').then((interception) => {
      const cheeseChange = interception.request.body.items.find((item: { id: number }) => item.id === 2000);
      expect(cheeseChange.parent_item_id).to.eq(null);
    });

    cy.get('[data-testid="shopping-list-item-row-2000"]')
      .should('have.attr', 'style')
      .and('include', 'margin-left: 0rem');
  });
});
