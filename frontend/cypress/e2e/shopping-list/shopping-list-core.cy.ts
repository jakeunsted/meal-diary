describe('Shopping list', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.loginViaUi();
    cy.get('[data-testid="nav-shopping-list"]').click();
    cy.location('pathname').should('eq', '/shopping-list');
    cy.wait('@apiGetShoppingList');
  });

  it('adds, renames, checks and removes an item', () => {
    cy.get('[data-testid="shopping-list-new-item-input"]').type('Milk');
    cy.get('[data-testid="shopping-list-new-item-button"]').click();
    cy.wait('@apiAddShoppingItem');
    cy.contains('[data-testid^="shopping-item-name-"]', 'Milk').should('be.visible');

    cy.contains('[data-testid^="shopping-item-name-"]', 'Milk').click();
    cy.get('[data-testid^="shopping-item-edit-input-"]').first().clear().type('Whole Milk{enter}');
    cy.wait('@apiUpdateShoppingItem');
    cy.contains('[data-testid^="shopping-item-name-"]', 'Whole Milk').should('be.visible');

    cy.contains('[data-testid^="shopping-item-name-"]', 'Whole Milk')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiUpdateShoppingItem');
    cy.get('[data-testid="shopping-list-checked-items-title"]').should('contain.text', '(1)');

    cy.get('[data-testid="shopping-list-checked-items-title"]').click();
    cy.contains('[data-testid^="shopping-item-name-"]', 'Whole Milk')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-checkbox-"]')
      .click({ force: true });
    cy.wait('@apiUpdateShoppingItem');

    cy.contains('[data-testid^="shopping-item-name-"]', 'Whole Milk')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-remove-"]')
      .click({ force: true });
    cy.wait('@apiDeleteShoppingItem');
    cy.contains('[data-testid^="shopping-item-name-"]', 'Whole Milk').should('not.exist');
  });

  it('indents and outdents an item', () => {
    cy.get('[data-testid="shopping-list-new-item-input"]').type('Potatoes');
    cy.get('[data-testid="shopping-list-new-item-button"]').click();
    cy.wait('@apiAddShoppingItem');

    cy.contains('[data-testid^="shopping-item-name-"]', 'Potatoes')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-indent-"]')
      .click({ force: true });

    cy.contains('[data-testid^="shopping-item-name-"]', 'Potatoes')
      .parents('div.my-1.transition-opacity.duration-150')
      .first()
      .should('have.attr', 'style')
      .and('include', 'margin-left: 1.5rem');

    cy.contains('[data-testid^="shopping-item-name-"]', 'Potatoes')
      .closest('div.flex.items-center.justify-between.list-none.px-2.py-1')
      .find('[data-testid^="shopping-item-outdent-"]')
      .click({ force: true });

    cy.contains('[data-testid^="shopping-item-name-"]', 'Potatoes')
      .parents('div.my-1.transition-opacity.duration-150')
      .first()
      .should('have.attr', 'style')
      .and('include', 'margin-left: 0rem');
  });
});
