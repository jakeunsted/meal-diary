import './commands';
import './shoppingListCommands';

beforeEach(() => {
  cy.clearCookies();
  cy.clearLocalStorage();
});
