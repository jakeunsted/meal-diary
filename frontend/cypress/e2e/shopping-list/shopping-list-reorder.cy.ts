describe('Shopping list reordering', () => {
  beforeEach(() => {
    cy.visitShoppingList();
  });

  it('nests and unnests an item when dragging', () => {
    cy.addShoppingListItem('Potatoes');

    cy.dragShoppingListItem('Potatoes', 'Bread', { nest: true });
    cy.wait('@apiReorderShoppingItems').then((interception) => {
      const potatoesChange = interception.request.body.items.find((item: { id: number }) => item.id === 2000);
      expect(potatoesChange.parent_item_id).to.eq(1002);
    });

    cy.get('[data-testid="shopping-list-item-row-2000"]')
      .should('have.attr', 'style')
      .and('include', 'margin-left: 1.5rem');

    cy.dragShoppingListItem('Potatoes', 'Tomatoes', { below: true });
    cy.wait('@apiReorderShoppingItems').then((interception) => {
      const potatoesChange = interception.request.body.items.find((item: { id: number }) => item.id === 2000);
      expect(potatoesChange.parent_item_id).to.eq(null);
    });

    cy.get('[data-testid="shopping-list-item-row-2000"]')
      .should('have.attr', 'style')
      .and('include', 'margin-left: 0rem');
  });

  it('keeps sibling order when nesting an item under a parent', () => {
    cy.addShoppingListItem('Potatoes');

    cy.getActiveShoppingListItemNames().should('deep.equal', ['Tomatoes', 'Bread', 'Potatoes']);

    cy.dragShoppingListItem('Potatoes', 'Bread', { nest: true });
    cy.wait('@apiReorderShoppingItems');

    cy.getActiveShoppingListItemNames().should('deep.equal', ['Tomatoes', 'Bread', 'Potatoes']);
    cy.get('[data-testid="shopping-list-item-row-2000"]')
      .should('have.attr', 'style')
      .and('include', 'margin-left: 1.5rem');
  });
});
