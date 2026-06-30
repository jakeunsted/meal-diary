describe('Shopping list hierarchy', () => {
  beforeEach(() => {
    cy.visitShoppingList();
  });

  it('joins a grouping instead of nesting under a child item', () => {
    cy.addShoppingListItem('Cheese');

    cy.dragShoppingListItem('Cheese', 'Bread', { nest: true });
    cy.wait('@apiReorderShoppingItems');

    cy.get('[data-testid="shopping-list-item-row-2000"]')
      .should('have.attr', 'style')
      .and('include', 'margin-left: 1.5rem');

    cy.addShoppingListItem('Butter');

    cy.dragShoppingListItem('Butter', 'Cheese', { nest: true });
    cy.wait('@apiReorderShoppingItems').then((interception) => {
      const butterChange = interception.request.body.items.find((item: { id: number }) => item.id === 2001);
      expect(butterChange.parent_item_id).to.eq(1002);
    });

    cy.get('[data-testid="shopping-list-item-row-2001"]')
      .should('have.attr', 'style')
      .and('include', 'margin-left: 1.5rem');
  });

  it('does not nest an item under an existing child when dragging right', () => {
    cy.addShoppingListItem('Cheese');

    cy.dragShoppingListItem('Cheese', 'Bread', { nest: true });
    cy.wait('@apiReorderShoppingItems');

    cy.addShoppingListItem('Butter');
    cy.dragShoppingListItem('Butter', 'Cheese', { nest: true });
    cy.wait('@apiReorderShoppingItems').then((interception) => {
      const butterChange = interception.request.body.items.find((item: { id: number }) => item.id === 2001);
      expect(butterChange.parent_item_id).to.eq(1002);
    });

    cy.get('[data-testid="shopping-list-item-row-2001"]')
      .should('have.attr', 'style')
      .and('include', 'margin-left: 1.5rem');
  });
});
