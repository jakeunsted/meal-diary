describe('Recipes', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.loginViaUi();
    cy.get('[data-testid="nav-recipes"]').click();
    cy.location('pathname').should('eq', '/recipes');
    cy.wait('@apiGetRecipes');
  });

  it('filters recipes by search query', () => {
    cy.get('[data-testid="recipes-search-input"]').type('Pasta');
    cy.contains('Pasta Bake').should('be.visible');

    cy.get('[data-testid="recipes-search-input"]').clear().type('No matching recipe');
    cy.contains('No recipes found').should('be.visible');
  });

  it('creates, edits and deletes a recipe', () => {
    cy.get('[data-testid="recipes-new-button"]').click();
    cy.location('pathname').should('eq', '/recipes/create');

    cy.get('[data-testid="recipe-form-name-input"]').type('Cypress Chilli');
    cy.get('[data-testid="recipe-form-description-input"]').type('A simple chilli.');
    cy.get('[data-testid="recipe-form-portions-input"]').clear().type('3');
    cy.get('[data-testid="recipe-form-add-ingredient-button"]').click();
    cy.get('[data-testid="recipe-form-ingredient-name-0"]').type('Beans');
    cy.get('[data-testid="recipe-form-ingredient-quantity-0"]').type('2');
    cy.get('[data-testid="recipe-form-ingredient-unit-0"]').type('tins');
    cy.get('[data-testid="recipe-form-submit-button"]').click();

    cy.wait('@apiCreateRecipe');
    cy.location('pathname').should('match', /\/recipes\/\d+$/);
    cy.contains('Cypress Chilli').should('be.visible');

    cy.get('[data-testid="recipe-edit-button"]').click();
    cy.location('pathname').should('match', /\/recipes\/\d+\/edit$/);
    cy.get('[data-testid="recipe-form-name-input"]').clear().type('Updated Cypress Chilli');
    cy.get('[data-testid="recipe-form-submit-button"]').click();

    cy.wait('@apiUpdateRecipe');
    cy.location('pathname').should('match', /\/recipes\/\d+$/);
    cy.contains('Updated Cypress Chilli').should('be.visible');

    cy.get('[data-testid="recipe-delete-button"]').click();
    cy.get('[data-testid="recipe-confirm-delete-button"]').click();

    cy.wait('@apiDeleteRecipe');
    cy.location('pathname').should('eq', '/recipes');
    cy.contains('Updated Cypress Chilli').should('not.exist');
  });

  it('adds recipe ingredients to the shopping list', () => {
    cy.get('[data-testid^="recipe-card-"]').first().click();
    cy.location('pathname').should('match', /\/recipes\/\d+$/);
    cy.get('[data-testid="recipe-add-to-shopping-list-button"]').click();

    cy.wait('@apiAddShoppingItemBulk');
    cy.contains('Ingredients added to shopping list!').should('be.visible');
  });
});
