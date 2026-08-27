describe('Shopping list categories', () => {
  beforeEach(() => {
    cy.visitShoppingList();
  });

  it('shows category tabs with unchecked counts', () => {
    cy.get('[data-testid="shopping-list-category-tabs"]').should('be.visible');
    cy.get('[data-testid="shopping-list-tab-count-all"]').should('contain.text', '2');
    cy.get('[data-testid="shopping-list-tab-count-fruit_veg"]').should('contain.text', '1');
    cy.get('[data-testid="shopping-list-tab-count-bakery"]').should('contain.text', '1');
  });

  it('auto-categorizes items added from the All tab', () => {
    cy.selectShoppingListTab('all');
    cy.get('[data-testid="shopping-list-new-item-input"]').clear().type('Chicken{enter}');
    cy.wait('@apiAddShoppingItem').its('request.body').should((body) => {
      expect(body.category).to.eq('meat');
    });
    cy.get('[data-testid="shopping-list-section-meat"]').should('be.visible');
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Chicken')
      .should('be.visible');
  });

  it('supports rapid consecutive Enter adds from All', () => {
    cy.selectShoppingListTab('all');
    cy.get('[data-testid="shopping-list-new-item-input"]').clear().type('Salmon{enter}');
    cy.wait('@apiAddShoppingItem');
    cy.get('[data-testid="shopping-list-new-item-input"]').should('have.value', '');
    cy.get('[data-testid="shopping-list-new-item-input"]').type('Apples{enter}');
    cy.wait('@apiAddShoppingItem');
    cy.get('[data-testid="shopping-list-new-item-input"]').type('Sourdough{enter}');
    cy.wait('@apiAddShoppingItem');

    cy.contains('[data-testid^="shopping-item-name-"]', 'Salmon').should('be.visible');
    cy.contains('[data-testid^="shopping-item-name-"]', 'Apples').should('be.visible');
    cy.contains('[data-testid^="shopping-item-name-"]', 'Sourdough').should('be.visible');
  });

  it('assigns the active category tab when adding', () => {
    cy.selectShoppingListTab('bakery');
    cy.get('[data-testid="shopping-list-new-item-input"]').clear().type('Toothpaste{enter}');
    cy.wait('@apiAddShoppingItem').its('request.body').should((body) => {
      expect(body.category).to.eq('bakery');
      expect(body.name).to.eq('Toothpaste');
    });
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Toothpaste')
      .should('be.visible');
  });

  it('filters items when switching category tabs', () => {
    cy.selectShoppingListTab('fruit_veg');
    cy.getActiveShoppingListItemNames().should('deep.equal', ['Tomatoes']);
    cy.selectShoppingListTab('bakery');
    cy.getActiveShoppingListItemNames().should('deep.equal', ['Bread']);
    cy.selectShoppingListTab('all');
    cy.getActiveShoppingListItemNames().should('deep.equal', ['Tomatoes', 'Bread']);
  });

  it('moves an item to another category via the row menu', () => {
    cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', 'Tomatoes')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-move-"]')
      .first()
      .click({ force: true });
    cy.get('[data-testid="shopping-item-move-1001-bakery"]').click({ force: true });
    cy.wait('@apiUpdateShoppingItem').its('request.body').should((body) => {
      expect(body.category).to.eq('bakery');
    });

    cy.selectShoppingListTab('bakery');
    cy.getActiveShoppingListItemNames().should('include', 'Tomatoes');
    cy.selectShoppingListTab('fruit_veg');
    cy.contains('[data-testid^="shopping-item-name-"]', 'Tomatoes').should('not.exist');
  });
});
