describe('Shopping list reorder', () => {
  beforeEach(() => {
    cy.visitShoppingList();
  });

  it('reorders items within a category via mouse drag', () => {
    cy.selectShoppingListTab('all');
    cy.addShoppingListItem('Carrots');
    cy.addShoppingListItem('Onions');

    cy.selectShoppingListTab('fruit_veg');
    cy.getActiveShoppingListItemNames().should('deep.equal', ['Tomatoes', 'Carrots', 'Onions']);

    cy.dragShoppingListItem('Tomatoes', 'Onions', { below: true });
    cy.wait('@apiReorderShoppingItems').its('request.body.items').should((items) => {
      expect(items).to.be.an('array');
      const fruitVeg = items.filter((item: { category: string }) => item.category === 'fruit_veg');
      expect(fruitVeg.map((item: { id: number }) => item.id)).to.have.length(3);
      fruitVeg.forEach((item: { category: string; position: number }) => {
        expect(item.category).to.eq('fruit_veg');
        expect(item.position).to.be.a('number');
      });
    });
  });
});
