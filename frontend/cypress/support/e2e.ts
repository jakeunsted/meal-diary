import './commands';
import './shoppingListCommands';

beforeEach(() => {
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.viewport(390, 844);
});
