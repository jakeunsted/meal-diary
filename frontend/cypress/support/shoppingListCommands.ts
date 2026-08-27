const getShoppingListRow = (itemName: string) =>
  cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', itemName)
    .closest('[data-testid^="shopping-list-sortable-row-"]');

Cypress.Commands.add('visitShoppingList', () => {
  cy.mockApi();
  cy.loginViaUi();
  cy.get('[data-testid="nav-shopping-list"]').click();
  cy.location('pathname').should('eq', '/shopping-list');
  cy.wait('@apiGetShoppingList');
  cy.get('[data-testid="shopping-list-active-items"]').should('be.visible');
});

Cypress.Commands.add('selectShoppingListTab', (tab: string) => {
  cy.get(`[data-testid="shopping-list-tab-${tab}"]`).click({ force: true });
});

Cypress.Commands.add('addShoppingListItem', (name: string) => {
  cy.get('[data-testid="shopping-list-new-item-input"]').clear().type(name);
  cy.get('[data-testid="shopping-list-new-item-button"]').click();
  cy.wait('@apiAddShoppingItem');
  cy.contains('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]', name)
    .should('be.visible');
});

Cypress.Commands.add('getActiveShoppingListItemNames', () => {
  return cy.get('[data-testid="shopping-list-active-items"] [data-testid^="shopping-item-name-"]').then(($elements) =>
    [...$elements].map((element) => element.textContent?.trim() ?? '')
  );
});

Cypress.Commands.add('expandCheckedShoppingListItems', () => {
  cy.get('[data-testid="shopping-list-checked-items-toggle"]').click({ force: true });
});

Cypress.Commands.add(
  'dragShoppingListItem',
  (sourceItemName: string, targetItemName: string, options: { below?: boolean } = {}) => {
    getShoppingListRow(sourceItemName).find('[data-sortable-handle]').then(($handle) => {
      const handle = $handle[0];
      const handleRect = handle.getBoundingClientRect();
      const startX = handleRect.left + handleRect.width / 2;
      const startY = handleRect.top + handleRect.height / 2;

      getShoppingListRow(targetItemName).then(($targetRow) => {
        const targetRect = $targetRow[0].getBoundingClientRect();
        const endX = targetRect.left + 8;
        const endY = options.below === false
          ? targetRect.top + 4
          : targetRect.bottom + 4;

        const pointerOptions = {
          pointerId: 1,
          button: 0,
          bubbles: true,
          cancelable: true,
          pointerType: 'mouse',
        };

        cy.wrap(handle).trigger('pointerdown', {
          ...pointerOptions,
          clientX: startX,
          clientY: startY,
          force: true,
        });
        cy.wrap(handle).trigger('pointermove', {
          ...pointerOptions,
          clientX: startX,
          clientY: startY + 8,
          force: true,
        });
        cy.document().trigger('pointermove', {
          ...pointerOptions,
          clientX: endX,
          clientY: endY - 12,
          force: true,
        });
        cy.document().trigger('pointermove', {
          ...pointerOptions,
          clientX: endX,
          clientY: endY,
          force: true,
        });
        cy.document().trigger('pointerup', {
          ...pointerOptions,
          clientX: endX,
          clientY: endY,
          force: true,
        });
      });
    });
  }
);

declare global {
  namespace Cypress {
    interface Chainable {
      visitShoppingList(): Chainable<void>;
      selectShoppingListTab(tab: string): Chainable<void>;
      addShoppingListItem(name: string): Chainable<void>;
      getActiveShoppingListItemNames(): Chainable<string[]>;
      expandCheckedShoppingListItems(): Chainable<void>;
      dragShoppingListItem(
        sourceItemName: string,
        targetItemName: string,
        options?: { below?: boolean }
      ): Chainable<void>;
    }
  }
}

export {};
